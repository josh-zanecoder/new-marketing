import type { SxProps } from '@mui/material';

/** Stock EmailBuilder canvas box — mobile 370×800 with shadow, desktop full width. */
export function templatePanelMainBoxSx(screenSize: 'mobile' | 'desktop'): SxProps {
  let sx: SxProps = {
    height: '100%',
  };

  if (screenSize === 'mobile') {
    sx = {
      ...sx,
      margin: '32px auto',
      width: 370,
      height: 800,
      boxShadow:
        'rgba(33, 36, 67, 0.04) 0px 10px 20px, rgba(33, 36, 67, 0.04) 0px 2px 6px, rgba(33, 36, 67, 0.04) 0px 0px 1px',
    };
  }

  return sx;
}
