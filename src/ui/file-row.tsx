import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { findCategory } from '../documents/formats';
import { fileSize, type SelectedFile } from '../documents/files';
import { useTheme } from '../theme/theme';
import { IconButton } from './components';

export function FileRow({ file, onRemove }: { file: SelectedFile; onRemove?: () => void }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border p-3"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: colors.soft }}>
        <Ionicons name={findCategory(file.category)?.icon ?? 'document-outline'} size={20} color={colors.accent} />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold" style={{ color: colors.ink }} selectable>{file.name}</Text>
        <Text className="text-sm" style={{ color: colors.muted }}>
          {file.extension.toUpperCase() || 'Unknown format'} · {fileSize(file.size)}
        </Text>
        <Text className="text-sm" style={{ color: colors.muted }}>
          {file.modifiedAt
            ? `Modified ${new Date(file.modifiedAt).toLocaleDateString()}`
            : `Selected ${new Date(file.selectedAt).toLocaleDateString()}`}
        </Text>
      </View>
      {onRemove && <IconButton icon="close-outline" label={`Remove ${file.name} from selection`} onPress={onRemove} />}
    </View>
  );
}
