import React from 'react';

import { Box, Drawer, Tab, Tabs } from '@mui/material';

import {
  setInspectorDrawerOpen,
  setSidebarTab,
  useInspectorDrawerOpen,
  useSelectedSidebarTab,
} from '../../documents/editor/EditorContext';
import { useOverlayDrawers } from '../../hooks/useResponsiveLayout';

import ConfigurationPanel from './ConfigurationPanel';
import ExportHtmlSidebarPanel from './ConfigurationPanel/ExportHtmlSidebarPanel';
import StylesPanel from './StylesPanel';

export const INSPECTOR_DRAWER_WIDTH = 320;

export default function InspectorDrawer() {
  const selectedSidebarTab = useSelectedSidebarTab();
  const inspectorDrawerOpen = useInspectorDrawerOpen();
  const overlayDrawers = useOverlayDrawers();
  const htmlTabActive = selectedSidebarTab === 'html';
  const drawerWidth = overlayDrawers
    ? htmlTabActive
      ? 'min(100vw, 480px)'
      : 'min(100vw, 320px)'
    : htmlTabActive
      ? 480
      : INSPECTOR_DRAWER_WIDTH;

  const renderCurrentSidebarPanel = () => {
    switch (selectedSidebarTab) {
      case 'block-configuration':
        return <ConfigurationPanel />;
      case 'styles':
        return <StylesPanel />;
      case 'html':
        return <ExportHtmlSidebarPanel />;
    }
  };

  return (
    <Drawer
      variant={overlayDrawers ? 'temporary' : 'persistent'}
      anchor="right"
      open={inspectorDrawerOpen}
      onClose={() => setInspectorDrawerOpen(false)}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: inspectorDrawerOpen && !overlayDrawers ? INSPECTOR_DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxHeight: '100dvh',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: drawerWidth,
          height: '100%',
          minHeight: 0,
        }}
      >
      <Box sx={{ width: drawerWidth, height: 49, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Box px={{ xs: 1, sm: 2 }}>
          <Tabs
            value={selectedSidebarTab}
            onChange={(_, v) => setSidebarTab(v)}
            variant="fullWidth"
            sx={{ minHeight: { xs: 44, sm: 48 } }}
          >
            <Tab value="styles" label="Styles" />
            <Tab value="block-configuration" label="Inspect" />
            <Tab value="html" label="HTML" />
          </Tabs>
        </Box>
      </Box>
      <Box
        sx={{
          width: drawerWidth,
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {renderCurrentSidebarPanel()}
      </Box>
      </Box>
    </Drawer>
  );
}
