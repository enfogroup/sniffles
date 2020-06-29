import { KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda'
import { SNS, SSM } from 'aws-sdk'
import { apply as jspathApply } from 'jspath'
import always from 'ramda/src/always'
import anyPass from 'ramda/src/anyPass'
import both from 'ramda/src/both'
import chain from 'ramda/src/chain'
import cond from 'ramda/src/cond'
import endsWith from 'ramda/src/endsWith'
import filter from 'ramda/src/filter'
import flip from 'ramda/src/flip'
import gt from 'ramda/src/gt'
import head from 'ramda/src/head'
import includes from 'ramda/src/includes'
import length from 'ramda/src/length'
import map from 'ramda/src/map'
import match from 'ramda/src/match'
import path from 'ramda/src/path'
import pathSatisfies from 'ramda/src/pathSatisfies'
import pipe from 'ramda/src/pipe'
import prop from 'ramda/src/prop'
import split from 'ramda/src/split'
import startsWith from 'ramda/src/startsWith'
import T from 'ramda/src/T'
import take from 'ramda/src/take'
import tap from 'ramda/src/tap'
import test from 'ramda/src/test'
import toString from 'ramda/src/toString'
import trim from 'ramda/src/trim'
// import { inspect } from 'util'
import { gunzipSync } from 'zlib'

interface LogEvent {
  readonly id: string
  readonly timestamp: number
  readonly message: string
}
type LogEvents = ReadonlyArray<LogEvent>
interface LogMessage {
  readonly messageType: string
  readonly owner: string
  readonly logGroup: string
  readonly logStream: string
  readonly subscriptonFilters: string[]
  readonly logEvents: LogEvents
}
type LogMessages = ReadonlyArray<LogMessage>

let lastFetch = new Date(0),
  whitelist: string[] = []

const
  { AccountId, ErrorMessage, ProjectKey, TopicArn, WhitelistParameterStorePath } = process.env,
  ssm = new SSM(),
  sns = new SNS(),
  secondsAgo = (n: number) => new Date(new Date().valueOf() - n * 1000),
  getWhitelist = () =>
    lastFetch < secondsAgo(60)
      ? ssm.getParameter({ Name: WhitelistParameterStorePath as string, WithDecryption: true }).promise()
        .then(path<string>([ 'Parameter', 'Value' ]) as (x: SSM.Types.GetParameterResult) => string)
        .then(split(',') as unknown as (x: string) => string[])
        .then(map(trim))
        .catch(pipe(
          tap(console.warn),
          always([ '.*' ]) // whitelist everything
        ))
        .then((wl) => {
          lastFetch = new Date()
          whitelist = wl
          return whitelist
        })
      : Promise.resolve(whitelist),
  toRegExp = pipe<string, string[], RegExp>(
    match(/^\/([^/]+)\/([gimsuy]*)$/),
    ([ _, re, flags ]) => new RegExp(re, flags) // eslint-disable-line security/detect-non-literal-regexp
  ),
  base64decode = (str: string) => Buffer.from(str, 'base64'),
  unzip = (buf: Buffer) => {
    try {
      return gunzipSync(buf)
    } catch {
      return buf
    }
  },
  parseRecord = pipe<KinesisStreamRecord, string, Buffer, Buffer, string, LogMessage, LogMessages>(
    path([ 'kinesis', 'data' ]) as any,
    base64decode,
    unzip,
    toString,
    JSON.parse,
    (m: LogMessage) => map((logEvent: LogEvent) => ({ ...m, logEvents: [ logEvent ] }))(m.logEvents)
  ),
  publishLog = (log: any) =>
    sns.publish({
      TopicArn,
      Message: JSON.stringify(log),
      Subject: take(100, `[${ProjectKey}] ${ErrorMessage} ${AccountId} ${log.logGroup}`),
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'create' },
        tags: { DataType: 'String', StringValue: ProjectKey },
      },
    }).promise()

export const
  toStringFn = includes,
  toRegExpFn = pipe<string, any, any>(toRegExp, test),
  toJspathFn = (str: string) =>
    pipe<string, string[], string, any, any, number, boolean>(
      match(/\t({.*})/),
      head,
      JSON.parse,
      (message: any) => jspathApply(`.${str}`, message),
      length,
      flip(gt)(0)
    ),
  toWhitelistFn = cond([
    [ test(/^\/[^/]+\/[gimsuy]*$/), toRegExpFn ],
    [ both(startsWith('{'), endsWith('}')), toJspathFn ],
    [ T, toStringFn ],
  ])

export const handler = (event: KinesisStreamEvent) =>
  getWhitelist()
    // .then(tap(console.log))
    .then(map(toWhitelistFn))
    .then((whitelistFns) => pipe<KinesisStreamEvent, KinesisStreamRecord[], LogMessages, LogMessages, LogMessages, Promise<SNS.Types.PublishResponse>[], Promise<SNS.Types.PublishResponse[]>>(
      prop<string, any>('Records'),
      chain(parseRecord),
      filter(pathSatisfies(anyPass(whitelistFns))([ 'logEvents', 0, 'message' ])) as unknown as (x: LogMessages) => LogMessages,
      tap((x) => console.log(`Found ${x.length} entries`)),
      map(publishLog),
      Promise.all.bind(Promise)
    )(event))
    // .then(tap(console.log))
    .then(() => 'OK')
    .catch(console.error)
