import * as core from '@actions/core'
import {TestExecutionResult, TestRunResult, TestSuiteResult} from './test-results'
import {Align, Icon, link, table} from '../utils/markdown-utils'
import {slug} from '../utils/slugger'

export interface ReportOptions {
  listSuites?: 'all' | 'only-failed'
  listTests?: 'all' | 'only-failed' | 'none'
}

export function getReport(results: TestRunResult[], options: ReportOptions = {}): string {
  const maxReportLength = 65535
  const sections: string[] = []

  const badge = getBadge(results)
  sections.push(badge)

  const runsSummary = results.map((tr, i) => getRunSummary(tr, i, options)).join('\n\n')
  sections.push(runsSummary)

  if (options.listTests !== 'none') {
    const suitesSummary = results
      .map((tr, runIndex) => {
        const suites = options.listSuites === 'only-failed' ? tr.failedSuites : tr.suites
        return suites
          .map((ts, suiteIndex) => getSuiteSummary(ts, runIndex, suiteIndex, options))
          .filter(str => str !== '')
      })
      .flat()
      .join('\n')

    const suitesSection = `# Test Suites\n\n${suitesSummary}`
    sections.push(suitesSection)
  }

  const report = sections.join('\n\n')
  if (report.length > maxReportLength) {
    let msg = `**Check Run summary limit of ${maxReportLength} chars was exceed**`
    if (options.listTests !== 'all') {
      msg += '\n- Consider setting `list-tests` option to `only-failed` or `none`'
    }
    if (options.listSuites !== 'all') {
      msg += '\n- Consider setting `list-suites` option to `only-failed`'
    }

    return `${badge}\n\n${msg}`
  }

  return report
}

function getBadge(results: TestRunResult[]): string {
  const passed = results.reduce((sum, tr) => sum + tr.passed, 0)
  const skipped = results.reduce((sum, tr) => sum + tr.skipped, 0)
  const failed = results.reduce((sum, tr) => sum + tr.failed, 0)

  const passedText = passed > 0 ? `${passed} passed` : null
  const skippedText = skipped > 0 ? `${skipped} skipped` : null
  const failedText = failed > 0 ? `${failed} failed` : null
  const message = [passedText, skippedText, failedText].filter(s => s != null).join(', ') || 'none'
  let color = 'success'
  if (failed > 0) {
    color = 'critical'
  } else if (passed === 0 && failed === 0) {
    color = 'yellow'
  }

  const uri = encodeURIComponent(`tests-${message}-${color}`)
  const text = failed > 0 ? 'Tests failed' : 'Tests passed successfully'
  return `![${text}](https://img.shields.io/badge/${uri})`
}

function getRunSummary(tr: TestRunResult, runIndex: number, options: ReportOptions): string {
  core.info('Generating check run summary')
  const time = `${(tr.time / 1000).toFixed(3)}s`
  const headingLine1 = `### ${tr.path}`
  const headingLine2 = `**${tr.tests}** tests were completed in **${time}** with **${tr.passed}** passed, **${tr.skipped}** skipped and **${tr.failed}** failed.`

  const suites = options.listSuites === 'only-failed' ? tr.failedSuites : tr.suites
  const suitesSummary = suites.map((s, suiteIndex) => {
    const icon = getResultIcon(s.result)
    const tsTime = `${s.time}ms`
    const tsName = s.name
    const tsAddr = makeSuiteSlug(runIndex, suiteIndex, tsName).link
    const tsNameLink = link(tsName, tsAddr)
    return [icon, tsNameLink, s.tests, tsTime, s.passed, s.skipped, s.failed]
  })

  const summary =
    suites.length === 0
      ? ''
      : table(
          ['Result', 'Suite', 'Tests', 'Time', `Passed ${Icon.success}`, `Skipped ${Icon.skip}`, `Failed ${Icon.fail}`],
          [Align.Center, Align.Left, Align.Right, Align.Right, Align.Right, Align.Right, Align.Right],
          ...suitesSummary
        )

  return [headingLine1, headingLine2, summary].join('\n\n')
}

function getSuiteSummary(ts: TestSuiteResult, runIndex: number, suiteIndex: number, options: ReportOptions): string {
  const groups = options.listTests === 'only-failed' ? ts.failedGroups : ts.groups
  if (groups.length === 0) {
    return ''
  }

  const icon = getResultIcon(ts.result)
  const content = groups
    .map(grp => {
      const tests = options.listTests === 'only-failed' ? grp.failedTests : grp.tests
      if (tests.length === 0) {
        return ''
      }
      const header = grp.name ? `### ${grp.name}\n\n` : ''
      const testsTable = table(
        ['Result', 'Test', 'Time'],
        [Align.Center, Align.Left, Align.Right],
        ...grp.tests.map(tc => {
          const name = tc.name
          const time = `${tc.time}ms`
          const result = getResultIcon(tc.result)
          return [result, name, time]
        })
      )

      return `${header}${testsTable}\n`
    })
    .join('\n')

  const tsName = ts.name
  const tsSlug = makeSuiteSlug(runIndex, suiteIndex, tsName)
  const tsNameLink = `<a id="${tsSlug.id}" href="${tsSlug.link}">${tsName}</a>`
  return `## ${tsNameLink} ${icon}\n\n${content}`
}

function makeSuiteSlug(runIndex: number, suiteIndex: number, name: string): {id: string; link: string} {
  // use prefix to avoid slug conflicts after escaping the paths
  return slug(`r${runIndex}s${suiteIndex}-${name}`)
}

function getResultIcon(result: TestExecutionResult): string {
  switch (result) {
    case 'success':
      return Icon.success
    case 'skipped':
      return Icon.skip
    case 'failed':
      return Icon.fail
    default:
      return ''
  }
}
