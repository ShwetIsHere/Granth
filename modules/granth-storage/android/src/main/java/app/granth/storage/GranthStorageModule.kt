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
import android.provider.OpenableColumns
import android.provider.DocumentsContract
import android.provider.Settings
import android.system.Os
import android.system.OsConstants
import android.util.Base64
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.util.UUID
import kotlin.math.roundToInt

class GranthStorageModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private var pendingPdf: Uri? = null
  private var initialIntentConsumed = false

  private fun pdfUri(intent: Intent?): Uri? {
    if (intent == null || intent.action != Intent.ACTION_VIEW ||
      intent.type?.substringBefore(';')?.equals("application/pdf", true) != true) {
      return null
    }
    return intent.data?.takeIf { it.scheme == "content" || it.scheme == "file" }
  }

  @Synchronized
  private fun rememberPdf(uri: Uri) {
    pendingPdf = uri
  }

  @Synchronized
  private fun takePdfUri(): Uri? {
    val initial = if (initialIntentConsumed) null else pdfUri(appContext.currentActivity?.intent)
    initialIntentConsumed = true
    val uri = pendingPdf ?: initial
    pendingPdf = null
    return uri
  }

  private fun pdfMetadata(uri: Uri): Map<String, Any> {
    var name: String? = null
    var size: Long? = null
    if (uri.scheme == "content") {
      runCatching {
        val fields = arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        context.contentResolver.query(uri, fields, null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) {
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0 && !cursor.isNull(nameIndex)) name = cursor.getString(nameIndex)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
          }
        }
      }
    } else {
      uri.path?.let { path ->
        val file = File(path)
        name = file.name
        if (file.isFile) size = file.length()
      }
    }
    val fileName = name?.takeIf { it.isNotBlank() }
      ?: uri.lastPathSegment?.substringAfterLast('/')?.takeIf { it.endsWith(".pdf", true) }
      ?: "Document.pdf"
    return buildMap {
      put("uri", seekablePdfUri(uri).toString())
      put("name", fileName)
      size?.let { put("size", it.toDouble()) }
    }
  }

  private fun seekablePdfUri(uri: Uri): Uri {
    if (uri.scheme != "content") return uri
    return runCatching {
      val resolver = context.contentResolver
      val seekable = resolver.openFileDescriptor(uri, "r")?.use { descriptor ->
        runCatching { Os.lseek(descriptor.fileDescriptor, 0, OsConstants.SEEK_CUR) }.isSuccess
      } ?: return uri
      if (seekable) return uri

      val cache = File(context.cacheDir, "incoming-pdfs")
      check(cache.isDirectory || cache.mkdirs())
      val cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
      cache.listFiles().orEmpty().filter { it.lastModified() < cutoff }.forEach { it.delete() }
      val temp = File.createTempFile("incoming-", ".pdf", cache)
      try {
        requireNotNull(resolver.openInputStream(uri)).use { input ->
          temp.outputStream().use { output -> input.copyTo(output) }
        }
        Uri.fromFile(temp)
      } catch (exception: Exception) {
        temp.delete()
        throw exception
      }
    }.getOrDefault(uri)
  }

  private fun hasAccess(): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager()

  override fun definition() = ModuleDefinition {
    Name("GranthStorage")
    Events("onPdfOpen")

    OnNewIntent { intent ->
      pdfUri(intent)?.let { uri ->
        rememberPdf(uri)
        sendEvent("onPdfOpen")
      }
    }

    AsyncFunction("takePdfOpenRequest") { takePdfUri()?.let(::pdfMetadata) }

    AsyncFunction("renameFile") { source: String, newName: String ->
      require(newName.isNotBlank() && newName != "." && newName != ".." &&
        newName.none { it == '/' || it == '\\' || it.isISOControl() }) { "Invalid file name." }
      val uri = Uri.parse(source)
      val renamed = when (uri.scheme) {
        "file" -> {
          check(hasAccess()) { "Allow storage access before renaming files." }
          val original = File(requireNotNull(uri.path)).canonicalFile
          val storage = requireNotNull(context.getSystemService(StorageManager::class.java))
          check(storage.storageVolumes.any { volume ->
            val root = runCatching { volume.directory?.canonicalFile?.toPath() }.getOrNull()
            root != null && original.toPath().startsWith(root)
          }) { "This file is outside shared storage." }
          check(original.isFile) { "The original file is unavailable." }
          val target = File(requireNotNull(original.parentFile), newName)
          if (target != original) {
            check(!target.exists()) { "A file with that name already exists." }
            Files.move(original.toPath(), target.toPath())
          }
          Uri.fromFile(target)
        }
        "content" -> {
          check(DocumentsContract.isDocumentUri(context, uri)) { "This provider does not allow renaming this file." }
          checkNotNull(DocumentsContract.renameDocument(context.contentResolver, uri, newName)) {
            "This provider does not allow renaming this file."
          }
        }
        else -> error("Unsupported file location.")
      }
      val actualName = if (renamed.scheme == "content") runCatching {
        context.contentResolver.query(renamed, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) cursor.getString(0) else null
        }
      }.getOrNull() else null
      mapOf("uri" to renamed.toString(), "name" to (actualName ?: newName))
    }

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
