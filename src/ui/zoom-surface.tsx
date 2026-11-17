import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, View, type GestureResponderEvent } from 'react-native';
import { fitPage, moveZoom, type Zoom } from '../documents/pdf-zoom';

function touchPoint(event: GestureResponderEvent, width: number, height: number) {
  const [first, second] = event.nativeEvent.touches;
  if (!first) return;
  return {
    x: (first.locationX + (second?.locationX ?? first.locationX)) / 2 - width / 2,
    y: (first.locationY + (second?.locationY ?? first.locationY)) / 2 - height / 2,
    distance: second ? Math.max(1, Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY)) : 0,
  };
}

export function ZoomSurface({ width, height, children, onZoom }: {
  width: number; height: number; children: ReactNode; onZoom: (zoomed: boolean) => void;
}) {
  const [zoom, setZoom] = useState(fitPage);
  const current = useRef(fitPage);
  const start = useRef<{ point: NonNullable<ReturnType<typeof touchPoint>>; zoom: Zoom } | undefined>(undefined);

  const gestures = useMemo(() => {
    const begin = (event: GestureResponderEvent) => {
      const point = touchPoint(event, width, height);
      start.current = point && { point, zoom: current.current };
    };
    const finish = () => {
      const zoomed = current.current.scale > 1.01;
      if (!zoomed) {
        current.current = fitPage;
        setZoom(fitPage);
      }
      onZoom(zoomed);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: event => height > 0 && (event.nativeEvent.touches.length > 1 || current.current.scale > 1),
      onMoveShouldSetPanResponder: event => height > 0 && event.nativeEvent.touches.length > 1,
      onPanResponderGrant: begin,
      onPanResponderMove: event => {
        const point = touchPoint(event, width, height);
        const origin = start.current;
        if (!point || !origin || Boolean(point.distance) !== Boolean(origin.point.distance)) {
          begin(event);
          return;
        }
        const ratio = point.distance ? point.distance / origin.point.distance : 1;
        const next = moveZoom(origin.zoom, origin.point, point, ratio, width, height);
        current.current = next;
        setZoom(next);
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
      onPanResponderTerminationRequest: () => false,
    });
  }, [height, onZoom, width]);

  return (
    <View collapsable={false} {...gestures.panHandlers} style={{ width, height: height || undefined, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ transform: [{ translateX: zoom.x }, { translateY: zoom.y }, { scale: zoom.scale }] }}>
        {children}
      </View>
    </View>
  );
}
