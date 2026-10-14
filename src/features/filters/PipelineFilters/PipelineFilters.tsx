import { FilterBar } from '../FilterBar/FilterBar';
import { ViewTabs } from '../ViewTabs/ViewTabs';

/**
 * PipelineFilters
 *
 * Everything that decides which deals the list shows: the stage tabs on top
 * and the search/filter bar below them.
 */
export function PipelineFilters() {
  return (
    <>
      <ViewTabs />
      <FilterBar />
    </>
  );
}
