package app.granth.storage

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.os.storage.StorageManager
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import kotlin.math.roundToInt

class GranthStorageModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  private fun hasAccess(): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager()

  override fun definition() = ModuleDefinition {
    Name("GranthStorage")

    Function("isDiscoverySupported") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.R }
    Function("hasAccess") { hasAccess() }

    AsyncFunction("requestAccess") {
      check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
      val activity = requireNotNull(appContext.currentActivity)
      activity.startActivity(Intent(
        Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
        Uri.fromParts("package", activity.packageName, null)
      ))
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("scan") {
      check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && hasAccess())
      val storage = requireNotNull(context.getSystemService(StorageManager::class.java))
      val roots = storage.storageVolumes.mapNotNull { volume ->
        if (volume.state != Environment.MEDIA_MOUNTED && volume.state != Environment.MEDIA_MOUNTED_READ_ONLY) {
          return@mapNotNull null
        }
        val directory = runCatching { volume.directory?.canonicalFile }.getOrNull() ?: return@mapNotNull null
        directory to volume.getDescription(context)
      }.distinctBy { it.first }
      val entries = mutableListOf<Map<String, Any>>()
      for ((root, label) in roots) {
        val excluded = setOf(File(root, "Android/data"), File(root, "Android/obb"))
        val pending = ArrayDeque<File>()
        pending.add(root)
        while (pending.isNotEmpty()) {
          val directory = pending.removeLast()
          for (entry in directory.listFiles().orEmpty()) {
            // Skip aliases and protected directories, and stay inside the selected volume.
            if (entry in excluded || runCatching { entry.canonicalFile }.getOrNull() != entry) continue
            if (entry.isDirectory) {
              pending.add(entry)
            } else if (entry.isFile) {
              entries.add(mapOf(
                "uri" to Uri.fromFile(entry).toString(),
                "name" to entry.name,
                "location" to entry.parentFile!!.relativeTo(root).path.ifEmpty { "/" },
                "volume" to label,
                "size" to entry.length().toDouble(),
                "modifiedAt" to entry.lastModified().toDouble()
              ))
            }
          }
        }
      }
      entries
    }

    AsyncFunction("prepareExternalPreview") { source: String ->
      check(hasAccess())
      val uri = Uri.parse(source)
      check(uri.scheme == "file")
      val original = File(requireNotNull(uri.path))
      val cache = File(context.cacheDir, "external-previews")
      check(cache.isDirectory || cache.mkdirs())
      // Keep a previously granted copy available while the external viewer loads it.
      val cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
      for (directory in cache.listFiles().orEmpty()) {
        if (directory.lastModified() < cutoff) {
          for (file in directory.listFiles().orEmpty()) file.delete()
          directory.delete()
        }
      }
      val session = File(cache, UUID.randomUUID().toString())
      check(session.mkdir())
      val copy = File(session, original.name)
      try {
        original.copyTo(copy)
        Uri.fromFile(copy).toString()
      } catch (exception: Exception) {
        copy.delete()
        session.delete()
        throw exception
      }
    }

    AsyncFunction("renderPdfPage") { source: String, pageIndex: Int ->
      val uri = Uri.parse(source)
      val descriptor = when (uri.scheme) {
        "file" -> ParcelFileDescriptor.open(File(requireNotNull(uri.path)), ParcelFileDescriptor.MODE_READ_ONLY)
        "content" -> requireNotNull(context.contentResolver.openFileDescriptor(uri, "r"))
        else -> error("Unsupported file URI")
      }
      val renderer = try {
        PdfRenderer(descriptor)
      } catch (exception: Exception) {
        descriptor.close()
        throw exception
      }
      renderer.use { pdf ->
        pdf.openPage(pageIndex).use { page ->
          val scale = 1440.0 / maxOf(page.width, page.height)
          val width = (page.width * scale).roundToInt().coerceAtLeast(1)
          val height = (page.height * scale).roundToInt().coerceAtLeast(1)
          val image = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
          try {
            image.eraseColor(Color.WHITE)
            page.render(image, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            val output = ByteArrayOutputStream()
            check(image.compress(Bitmap.CompressFormat.JPEG, 88, output))
            mapOf(
              "image" to "data:image/jpeg;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP),
              "width" to width,
              "height" to height,
              "pageCount" to pdf.pageCount
            )
          } finally {
            image.recycle()
          }
        }
      }
    }
  }
}
