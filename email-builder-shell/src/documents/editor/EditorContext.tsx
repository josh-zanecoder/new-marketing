import { create } from 'zustand';

import getConfiguration from '../../getConfiguration';

import { TEditorConfiguration } from './core';
import { isOverlayDrawerViewport } from '../../hooks/useResponsiveLayout';
import { applyEditedEmailHtmlToDocument, syncFullDocumentHtml } from '../../utils/applyEditedEmailHtml';

type TValue = {
  document: TEditorConfiguration;

  selectedBlockId: string | null;
  selectedSidebarTab: 'block-configuration' | 'styles' | 'html';
  selectedMainTab: 'editor' | 'preview' | 'json' | 'html';
  selectedScreenSize: 'desktop' | 'mobile';

  inspectorDrawerOpen: boolean;
  samplesDrawerOpen: boolean;
};

const overlayInitially = isOverlayDrawerViewport();

const editorStateStore = create<TValue>(() => ({
  document: getConfiguration(window.location.hash),
  selectedBlockId: null,
  selectedSidebarTab: 'styles',
  selectedMainTab: 'editor',
  selectedScreenSize: overlayInitially ? 'mobile' : 'desktop',

  inspectorDrawerOpen: !overlayInitially,
  samplesDrawerOpen: !overlayInitially,
}));

export function useDocument() {
  return editorStateStore((s) => s.document);
}

export function useSelectedBlockId() {
  return editorStateStore((s) => s.selectedBlockId);
}

export function useSelectedScreenSize() {
  return editorStateStore((s) => s.selectedScreenSize);
}

export function useSelectedMainTab() {
  return editorStateStore((s) => s.selectedMainTab);
}

export function setSelectedMainTab(selectedMainTab: TValue['selectedMainTab']) {
  return editorStateStore.setState({ selectedMainTab });
}

export function useSelectedSidebarTab() {
  return editorStateStore((s) => s.selectedSidebarTab);
}

export function useInspectorDrawerOpen() {
  return editorStateStore((s) => s.inspectorDrawerOpen);
}

export function useSamplesDrawerOpen() {
  return editorStateStore((s) => s.samplesDrawerOpen);
}

export function setSelectedBlockId(selectedBlockId: TValue['selectedBlockId']) {
  const selectedSidebarTab = selectedBlockId === null ? 'styles' : 'block-configuration';
  const options: Partial<TValue> = {};
  if (selectedBlockId !== null) {
    options.inspectorDrawerOpen = true;
  }
  return editorStateStore.setState({
    selectedBlockId,
    selectedSidebarTab,
    ...options,
  });
}

export function setSidebarTab(selectedSidebarTab: TValue['selectedSidebarTab']) {
  return editorStateStore.setState({ selectedSidebarTab });
}

export function resetDocument(document: TValue['document']) {
  return editorStateStore.setState({
    document,
    selectedSidebarTab: 'styles',
    selectedBlockId: null,
  });
}

/** Re-import edited full HTML while keeping the current sidebar/main tab when possible. */
export function replaceDocumentFromEditedHtml(html: string) {
  const nextDocument = applyEditedEmailHtmlToDocument(html);
  const { selectedSidebarTab, selectedMainTab } = editorStateStore.getState();
  return editorStateStore.setState({
    document: nextDocument,
    selectedBlockId: null,
    selectedSidebarTab,
    selectedMainTab,
  });
}

export function getEditorDocument() {
  return editorStateStore.getState().document;
}

export function setDocument(document: TValue['document']) {
  const originalDocument = editorStateStore.getState().document;
  const merged = {
    ...originalDocument,
    ...document,
  };
  const nextDocument = syncFullDocumentHtml(merged);
  return editorStateStore.setState({
    document: nextDocument,
  });
}

export function toggleInspectorDrawerOpen() {
  const state = editorStateStore.getState();
  const next = !state.inspectorDrawerOpen;
  const overlay = isOverlayDrawerViewport();
  return editorStateStore.setState({
    inspectorDrawerOpen: next,
    ...(overlay && next ? { samplesDrawerOpen: false } : {}),
  });
}

export function toggleSamplesDrawerOpen() {
  const state = editorStateStore.getState();
  const next = !state.samplesDrawerOpen;
  const overlay = isOverlayDrawerViewport();
  return editorStateStore.setState({
    samplesDrawerOpen: next,
    ...(overlay && next ? { inspectorDrawerOpen: false } : {}),
  });
}

export function setSamplesDrawerOpen(open: boolean) {
  return editorStateStore.setState({ samplesDrawerOpen: open });
}

export function setInspectorDrawerOpen(open: boolean) {
  return editorStateStore.setState({ inspectorDrawerOpen: open });
}

export function setSelectedScreenSize(selectedScreenSize: TValue['selectedScreenSize']) {
  return editorStateStore.setState({ selectedScreenSize });
}

export function syncDrawersForDesktopLayout(): void {
  if (isOverlayDrawerViewport()) return;

  const { inspectorDrawerOpen, samplesDrawerOpen } = editorStateStore.getState();
  if (!inspectorDrawerOpen && !samplesDrawerOpen) {
    editorStateStore.setState({
      inspectorDrawerOpen: true,
      samplesDrawerOpen: true,
    });
  }
}
