import * as github from '@actions/github'
import {EventPayloads} from '@octokit/webhooks'

import {TestResult} from '../parsers/parser-types'
import {ellipsis} from './markdown-utils'

export function getCheckRunSha(): string {
  if (github.context.payload.pull_request) {
    const pr = github.context.payload.pull_request as EventPayloads.WebhookPayloadPullRequestPullRequest
    return pr.head.sha
  }

  return github.context.sha
}

export function enforceCheckRunLimits(result: TestResult, maxAnnotations: number): void {
  // Limit number of created annotations
  result.annotations.splice(maxAnnotations + 1)

  // Limit number of characters in annotation fields
  for (const err of result.annotations) {
    err.title = ellipsis(err.title || '', 255)
    err.message = ellipsis(err.message, 65535)
  }
}
