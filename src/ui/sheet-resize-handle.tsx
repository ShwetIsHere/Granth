import { useMemo, useRef } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { useTheme } from '../theme/theme';

export type Dimension = { kind: 'columns' | 'rows'; id: string; size: number };

export function SheetResizeHandle({ target, zoom, onFinish }: {
  target: Dimension; zoom: number; onFinish: (size: number) => void;
}) {
  const { colors } = useTheme();
  const props = useRef({ target, zoom, onFinish });
  props.current = { target, zoom, onFinish };
  const drag = useRef({ start: target.size, size: target.size, zoom });
  const guide = useMemo(() => new Animated.Value(0), []);
  const column = target.kind === 'columns';
  const clamp = (size: number) => Math.round(Math.min(column ? 1600 : 600, Math.max(column ? 16 : 12, size)));
  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: event => event.nativeEvent.touches.length === 1,
    onPanResponderGrant: () => {
      const current = props.current;
      drag.current = { start: current.target.size, size: current.target.size, zoom: current.zoom };
      guide.setValue(0);
    },
    onPanResponderMove: (_, state) => {
      const current = drag.current;
      current.size = clamp(current.start + (column ? state.dx : state.dy) / current.zoom);
      guide.setValue((current.size - current.start) * current.zoom);
    },
    onPanResponderRelease: () => {
      guide.setValue(0);
      props.current.onFinish(drag.current.size);
    },
    onPanResponderTerminate: () => guide.setValue(0),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [column, guide]);

  return <View collapsable={false} {...gestures.panHandlers} accessible accessibilityRole="adjustable"
    accessibilityLabel={`Resize ${column ? 'column' : 'row'} ${target.id}`}
    accessibilityValue={{ now: Math.round(target.size) }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={event => {
      const action = event.nativeEvent.actionName;
      if (action === 'increment' || action === 'decrement') onFinish(clamp(target.size + (action === 'increment' ? 8 : -8)));
    }}
    style={{ position: 'absolute', zIndex: 2, right: 0, bottom: 0,
      ...(column ? { top: 0, width: 26, alignItems: 'flex-end', justifyContent: 'center' }
        : { left: 0, height: 18, alignItems: 'center', justifyContent: 'flex-end' }) }}>
    <Animated.View pointerEvents="none" style={{ width: column ? 3 : 18, height: column ? 18 : 3,
      backgroundColor: colors.accent, transform: column ? [{ translateX: guide }] : [{ translateY: guide }] }} />
  </View>;
}
