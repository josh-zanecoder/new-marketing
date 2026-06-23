import React, { useEffect } from 'react';

import { Box, useTheme } from '@mui/material';

import { syncDrawersForDesktopLayout, useInspectorDrawerOpen, useSamplesDrawerOpen } from '../documents/editor/EditorContext';
import { useOverlayDrawers } from '../hooks/useResponsiveLayout';

import InspectorDrawer, { INSPECTOR_DRAWER_WIDTH } from './InspectorDrawer';
import SamplesDrawer, { SAMPLES_DRAWER_WIDTH } from './SamplesDrawer';
import TemplatePanel from './TemplatePanel';

function useDrawerTransition(cssProperty: 'margin-left' | 'margin-right', open: boolean) {
  const { transitions } = useTheme();
  return transitions.create(cssProperty, {
    easing: !open ? transitions.easing.sharp : transitions.easing.easeOut,
    duration: !open ? transitions.duration.leavingScreen : transitions.duration.enteringScreen,
  });
}

export default function App() {
  const inspectorDrawerOpen = useInspectorDrawerOpen();
  const samplesDrawerOpen = useSamplesDrawerOpen();
  const overlayDrawers = useOverlayDrawers();

  const marginLeftTransition = useDrawerTransition('margin-left', samplesDrawerOpen);
  const marginRightTransition = useDrawerTransition('margin-right', inspectorDrawerOpen);

  const leftInset = !overlayDrawers && samplesDrawerOpen ? SAMPLES_DRAWER_WIDTH : 0;
  const rightInset = !overlayDrawers && inspectorDrawerOpen ? INSPECTOR_DRAWER_WIDTH : 0;

  useEffect(() => {
    syncDrawersForDesktopLayout();
  }, [overlayDrawers]);

  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      <InspectorDrawer />
      <SamplesDrawer />

      <Box
        sx={{
          marginLeft: leftInset ? `${leftInset}px` : 0,
          marginRight: rightInset ? `${rightInset}px` : 0,
          minWidth: 0,
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          boxSizing: 'border-box',
          transition: [marginLeftTransition, marginRightTransition].join(', '),
        }}
      >
        <TemplatePanel />
      </Box>
    </Box>
  );
}
