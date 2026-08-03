// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Box, Checkbox, useForkRef, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useInView } from 'react-intersection-observer';
import { DataQueriesProvider, usePlugin, useSuggestedStepMs } from '@perses-dev/plugin-system';
import React, { ReactElement, useMemo, useState } from 'react';
import { BooleanParam, JsonParam, useQueryParam } from 'use-query-params';
import { isPanelGroupItemIdEqual, PanelGroupItemId } from '../../model'; // TODO
import { useEditMode, usePanel, usePanelActions, usePanelKey, useViewPanelGroup } from '../../context';
import { usePanelFocusHandlers } from '../../keyboard-shortcuts';
import { Panel, PanelProps, PanelOptions } from '../Panel';
import { QueryViewerDialog } from '../QueryViewerDialog';

export interface GridItemContentProps {
  panelGroupItemId: PanelGroupItemId;
  width: number; // necessary for determining the suggested step ms
  panelOptions?: PanelOptions;
}

/**
 * Resolves the reference to panel content in a GridItemDefinition and renders the panel.
 */
export function GridItemContent(props: GridItemContentProps): ReactElement {
  const { panelGroupItemId, width } = props;
  const theme = useTheme();
  const panelDefinition = usePanel(panelGroupItemId);

  const {
    spec: { queries },
  } = panelDefinition;

  const { isEditMode } = useEditMode();
  const { openEditPanel, openDeletePanelDialog, duplicatePanel, viewPanel } = usePanelActions(panelGroupItemId);
  const viewPanelGroupItemId = useViewPanelGroup();

  // Panel focus tracking for keyboard shortcuts
  const { onMouseEnter, onMouseLeave } = usePanelFocusHandlers(
    `${panelGroupItemId.panelGroupId}-${panelGroupItemId.panelGroupItemLayoutId}`
  );

  const { ref: queryRef, inView: shouldQuery } = useInView({
    threshold: 0,
    initialInView: false,
    triggerOnce: true,
  });

  const { ref: renderRef, inView: shouldRender } = useInView({
    threshold: 0.2,
    initialInView: false,
    triggerOnce: false,
  });

  const mergedRef = useForkRef(renderRef, queryRef);

  const [openQueryViewer, setOpenQueryViewer] = useState(false);

  const [detailedView, setDetailedView] = useQueryParam('detailedView', BooleanParam);
  const isDetailedView = detailedView === true;

  // Panel selection state
  const [panelSelectMode] = useQueryParam('panelSelectMode', BooleanParam);
  const [selectedPanels, setSelectedPanels] = useQueryParam('selectedPanels', JsonParam);
  const panelKey = usePanelKey(panelGroupItemId);
  const isSelectMode = panelSelectMode === true;
  const isViewingSelected = Array.isArray(selectedPanels) && selectedPanels.length > 0 && !isSelectMode;
  const isSelected =
    isSelectMode && Array.isArray(selectedPanels) && panelKey ? (selectedPanels as string[]).includes(panelKey) : false;

  const handleToggleSelect = (): void => {
    if (!panelKey) return;
    const current: string[] = Array.isArray(selectedPanels) ? (selectedPanels as string[]) : [];
    setSelectedPanels(isSelected ? current.filter((r) => r !== panelKey) : [...current, panelKey]);
  };

  const viewQueriesHandler = useMemo(() => {
    return isEditMode || !queries?.length
      ? undefined
      : {
          onClick: (): void => {
            setOpenQueryViewer(true);
          },
        };
  }, [isEditMode, queries]);

  const readHandlers = {
    isPanelViewed: isPanelGroupItemIdEqual(viewPanelGroupItemId, panelGroupItemId),
    onViewPanelClick: function (): void {
      if (viewPanelGroupItemId === undefined) {
        viewPanel(panelGroupItemId);
      } else {
        viewPanel(undefined);
      }
      setDetailedView(undefined);
    },
  };

  const detailedViewHandler = {
    onDetailedViewClick: function (): void {
      viewPanel(panelGroupItemId);
      setDetailedView(true);
    },
  };

  // Provide actions to the panel when in edit mode
  let editHandlers: PanelProps['editHandlers'] = undefined;
  if (isEditMode) {
    editHandlers = {
      onEditPanelClick: openEditPanel,
      onDuplicatePanelClick: duplicatePanel,
      onDeletePanelClick: openDeletePanelDialog,
    };
  }

  // map TimeSeriesQueryDefinition to Definition<UnknownSpec>
  const suggestedStepMs = useSuggestedStepMs(width);

  const { data: plugin } = usePlugin('Panel', panelDefinition.spec.plugin.kind);

  const pluginQueryOptions =
    typeof plugin?.queryOptions === 'function'
      ? plugin?.queryOptions(panelDefinition.spec.plugin.spec)
      : plugin?.queryOptions;

  return (
    <Box
      ref={mergedRef}
      tabIndex={-1}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{
        width: '100%',
        height: '100%',
        outline: 'none',
        position: 'relative',
      }}
    >
      {isSelectMode && (
        <Box
          onClick={handleToggleSelect}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            cursor: 'pointer',
            border: '2px solid',
            borderColor: isSelected ? theme.palette.primary.main : 'transparent',
            borderRadius: 1,
            bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
            transition: 'border-color 0.15s, background-color 0.15s',
            '&:hover': {
              borderColor: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          <Checkbox
            checked={isSelected}
            size="small"
            sx={{ position: 'absolute', top: 2, right: 4, pointerEvents: 'none', p: 0 }}
          />
        </Box>
      )}
      <DataQueriesProvider
        definitions={queries ?? []}
        options={{ suggestedStepMs, ...pluginQueryOptions }}
        queryOptions={{ enabled: shouldQuery }}
      >
        {shouldRender && (
          <Panel
            definition={panelDefinition}
            readHandlers={isDetailedView || isSelectMode || isViewingSelected ? undefined : readHandlers}
            detailedViewHandler={isDetailedView || isSelectMode || isViewingSelected ? undefined : detailedViewHandler}
            editHandlers={isDetailedView || isSelectMode || isViewingSelected ? undefined : editHandlers}
            viewQueriesHandler={isDetailedView || isSelectMode || isViewingSelected ? undefined : viewQueriesHandler}
            panelOptions={props.panelOptions}
            panelGroupItemId={panelGroupItemId}
          />
        )}
      </DataQueriesProvider>
      <QueryViewerDialog
        open={openQueryViewer}
        queryDefinitions={queries ?? []}
        onClose={() => setOpenQueryViewer(false)}
      />
    </Box>
  );
}
