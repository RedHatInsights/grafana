import { urlUtil, UrlQueryMap, Labels } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CombinedRule, FilterState, RulesSource, SilenceFilterState } from 'app/types/unified-alerting';
import { ALERTMANAGER_NAME_QUERY_KEY } from './constants';
import { getRulesSourceName } from './datasource';
import * as ruleId from './rule-id';
import { getMatcherQueryParams } from './matchers';

export function createViewLink(ruleSource: RulesSource, rule: CombinedRule, returnTo: string): string {
  const sourceName = getRulesSourceName(ruleSource);
  const identifier = ruleId.fromCombinedRule(sourceName, rule);
  const paramId = encodeURIComponent(ruleId.stringifyIdentifier(identifier));
  const paramSource = encodeURIComponent(sourceName);

  return urlUtil.renderUrl(`${config.appSubUrl}/alerting/${paramSource}/${paramId}/view`, { returnTo });
}

export function createExploreLink(dataSourceName: string, query: string) {
  return urlUtil.renderUrl(`${config.appSubUrl}/explore`, {
    left: JSON.stringify([
      'now-1h',
      'now',
      dataSourceName,
      { datasource: dataSourceName, expr: query },
      { ui: [true, true, true, 'none'] },
    ]),
  });
}

export function arrayToRecord(items: Array<{ key: string; value: string }>): Record<string, string> {
  return items.reduce<Record<string, string>>((rec, { key, value }) => {
    rec[key] = value;
    return rec;
  }, {});
}

export const getFiltersFromUrlParams = (queryParams: UrlQueryMap): FilterState => {
  const queryString = queryParams['queryString'] === undefined ? undefined : String(queryParams['queryString']);
  const alertState = queryParams['alertState'] === undefined ? undefined : String(queryParams['alertState']);
  const dataSource = queryParams['dataSource'] === undefined ? undefined : String(queryParams['dataSource']);
  const ruleType = queryParams['ruleType'] === undefined ? undefined : String(queryParams['ruleType']);
  const groupBy = queryParams['groupBy'] === undefined ? undefined : String(queryParams['groupBy']).split(',');
  return { queryString, alertState, dataSource, groupBy, ruleType };
};

export const getSilenceFiltersFromUrlParams = (queryParams: UrlQueryMap): SilenceFilterState => {
  const queryString = queryParams['queryString'] === undefined ? undefined : String(queryParams['queryString']);
  const silenceState = queryParams['silenceState'] === undefined ? undefined : String(queryParams['silenceState']);

  return { queryString, silenceState };
};

export function recordToArray(record: Record<string, string>): Array<{ key: string; value: string }> {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

export function makeAMLink(path: string, alertManagerName?: string): string {
  return `${path}${alertManagerName ? `?${ALERTMANAGER_NAME_QUERY_KEY}=${encodeURIComponent(alertManagerName)}` : ''}`;
}

export function makeRuleBasedSilenceLink(alertManagerSourceName: string, rule: CombinedRule) {
  const labels: Labels = {
    alertname: rule.name,
    ...rule.labels,
  };

  return makeLabelBasedSilenceLink(alertManagerSourceName, labels);
}

export function makeLabelBasedSilenceLink(alertManagerSourceName: string, labels: Labels) {
  const silenceUrlParams = new URLSearchParams();
  silenceUrlParams.append('alertmanager', alertManagerSourceName);

  const matcherParams = getMatcherQueryParams(labels);
  matcherParams.forEach((value, key) => silenceUrlParams.append(key, value));

  return `${config.appSubUrl}/alerting/silence/new?${silenceUrlParams.toString()}`;
}

// keep retrying fn if it's error passes shouldRetry(error) and timeout has not elapsed yet
export function retryWhile<T, E = Error>(
  fn: () => Promise<T>,
  shouldRetry: (e: E) => boolean,
  timeout: number, // milliseconds, how long to keep retrying
  pause = 1000 // milliseconds, pause between retries
): Promise<T> {
  const start = new Date().getTime();
  const makeAttempt = (): Promise<T> =>
    fn().catch((e) => {
      if (shouldRetry(e) && new Date().getTime() - start < timeout) {
        return new Promise((resolve) => setTimeout(resolve, pause)).then(makeAttempt);
      }
      throw e;
    });
  return makeAttempt();
}
