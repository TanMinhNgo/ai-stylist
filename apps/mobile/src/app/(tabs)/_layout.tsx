import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { TABS } from '@/components/tabs';
import { colors } from '@/theme';

// iOS: system Liquid Glass tab bar. Android uses _layout.android.tsx.
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.accent} minimizeBehavior="onScrollDown">
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name} disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
