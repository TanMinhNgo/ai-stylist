import { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { TABS } from '@/components/tabs';
import { Icon, Text } from '@/components/ui';
import { colors, radius, space } from '@/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const PAD = 5;

// Android: floating pill tab bar from the design, instead of the Material bottom navigation.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, animation: 'shift', sceneStyle: { backgroundColor: colors.ground } }}
      tabBar={(props) => <FloatingTabBar {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

function FloatingTabBar({ state, navigation, insets }: TabBarProps) {
  const [width, setWidth] = useState(0);
  const itemWidth = width > 0 ? (width - PAD * 2) / state.routes.length : 0;
  const x = useSharedValue(0);

  // The highlight slides between tabs like the iOS Liquid Glass lens.
  useEffect(() => {
    x.set(withSpring(state.index * itemWidth, { damping: 18, stiffness: 190, mass: 0.8 }));
  }, [state.index, itemWidth, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View style={[styles.bar, { bottom: insets.bottom + space.md }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {itemWidth > 0 ? <Animated.View style={[styles.indicator, { width: itemWidth }, indicator]} /> : null}
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.index === index;
        const color = focused ? colors.accent : colors.inkSecondary;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            style={styles.item}>
            <Icon ios={tab.sf} android={tab.md} size={24} color={color} />
            {/* Fixed weight: changing fontWeight at runtime clips text on Android. */}
            <Text variant="caption" color={color} numberOfLines={1} style={styles.label}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    height: 64,
    padding: PAD,
    flexDirection: 'row',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    elevation: 10,
    shadowColor: '#14141E',
  },
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
});
