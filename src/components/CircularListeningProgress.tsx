import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type CircularListeningProgressProps = {
  color: string;
  size: number;
  value: number;
};

const STROKE_WIDTH = 3;

export function CircularListeningProgress({
  color,
  size,
  value,
}: CircularListeningProgressProps) {
  const progress = Math.min(1, Math.max(0, value));
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Svg height={size} width={size}>
        <Circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke="rgba(0, 0, 0, 0.16)"
          strokeWidth={STROKE_WIDTH}
        />
        <Circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          strokeWidth={STROKE_WIDTH}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
