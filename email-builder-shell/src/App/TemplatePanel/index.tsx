import React from 'react';

import { MonitorOutlined, PhoneIphoneOutlined } from '@mui/icons-material';
import { Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';

import {
  setSelectedScreenSize,
  useDocument,
  useSelectedMainTab,
  useSelectedScreenSize,
} from '../../documents/editor/EditorContext';
import {
  useOverlayDrawers,
  usePhoneLayout,
} from '../../hooks/useResponsiveLayout';
import { isImportedHtmlPreviewDocument, type TEmailBuilderDocument } from '../../utils/exportEmailHtml';
import ToggleInspectorPanelButton from '../InspectorDrawer/ToggleInspectorPanelButton';
import ToggleSamplesPanelButton from '../SamplesDrawer/ToggleSamplesPanelButton';

import DownloadJson from './DownloadJson';
import HtmlPanel from './HtmlPanel';
import ImportHtml from './ImportHtml';
import ImportJson from './ImportJson';
import ImportedHtmlEditorPanel from './ImportedHtmlEditorPanel';
import JsonPanel from './JsonPanel';
import MainTabsGroup from './MainTabsGroup';
import ShareButton from './ShareButton';
import StockEditorPanel from './StockEditorPanel';
import StockPreviewPanel from './StockPreviewPanel';

export default function TemplatePanel() {
  const document = useDocument() as TEmailBuilderDocument;
  const selectedMainTab = useSelectedMainTab();
  const selectedScreenSize = useSelectedScreenSize();
  const importedHtml = isImportedHtmlPreviewDocument(document);
  const overlayDrawers = useOverlayDrawers();
  const phone = usePhoneLayout();

  const handleScreenSizeChange = (_: unknown, value: unknown) => {
    switch (value) {
      case 'mobile':
      case 'desktop':
        setSelectedScreenSize(value);
        return;
      default:
        setSelectedScreenSize('desktop');
    }
  };

  const renderMainPanel = () => {
    switch (selectedMainTab) {
      case 'editor':
        return importedHtml ? <ImportedHtmlEditorPanel /> : <StockEditorPanel />;
      case 'preview':
        return <StockPreviewPanel />;
      case 'html':
        return <HtmlPanel />;
      case 'json':
        return <JsonPanel />;
    }
  };

  return (
    <Stack sx={{ height: '100%', minHeight: 0, minWidth: 0, width: '100%', overflow: 'hidden' }}>
      <Stack
        sx={{
          minHeight: { xs: 44, sm: 49 },
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'white',
          position: 'sticky',
          top: 0,
          zIndex: 'appBar',
          px: { xs: 0.5, sm: 1, md: 1.5 },
          py: phone ? 0.5 : 0,
          gap: { xs: 0.5, md: 1 },
          flexShrink: 0,
        }}
        direction="row"
        flexWrap={phone ? 'wrap' : 'nowrap'}
        justifyContent="space-between"
        alignItems="center"
      >
        <ToggleSamplesPanelButton />
        <Stack
          px={{ xs: 0.5, sm: 1, md: 2 }}
          direction="row"
          gap={{ xs: 0.5, sm: 1, md: 2 }}
          flex={1}
          minWidth={0}
          justifyContent="space-between"
          alignItems="center"
          flexWrap={overlayDrawers ? 'wrap' : 'nowrap'}
        >
          <Stack direction="row" spacing={{ xs: 0.5, md: 2 }} sx={{ minWidth: 0, flex: { xs: '1 1 100%', md: '0 1 auto' } }}>
            <MainTabsGroup scrollable={overlayDrawers} dense={phone} />
          </Stack>
          <Stack
            direction="row"
            spacing={{ xs: 0.5, sm: 1, md: 2 }}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{
              flexShrink: 0,
              ml: { xs: 'auto', md: 0 },
              justifyContent: { xs: 'flex-end', md: 'flex-start' },
              flex: { xs: '1 1 auto', md: '0 1 auto' },
            }}
          >
            <DownloadJson />
            <ImportHtml />
            <ImportJson />
            <ToggleButtonGroup value={selectedScreenSize} exclusive size="small" onChange={handleScreenSizeChange}>
              <ToggleButton value="desktop">
                <Tooltip title="Desktop">
                  <MonitorOutlined fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="mobile">
                <Tooltip title="Mobile">
                  <PhoneIphoneOutlined fontSize="small" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
            <ShareButton />
          </Stack>
        </Stack>
        <ToggleInspectorPanelButton />
      </Stack>
      <Stack
        sx={{
          flex: 1,
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          minWidth: 0,
          width: '100%',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {renderMainPanel()}
      </Stack>
    </Stack>
  );
}
