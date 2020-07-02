import { KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda'
import { SNS, SSM } from 'aws-sdk'
import { Option, tryCatch as optTryCatch, chain as optchain, map as optmap, getOrElse as optGetOrElse, none, some } from 'fp-ts/lib/Option'
import { apply as jspathApply } from 'jspath'
import always from 'ramda/src/always'
import anyPass from 'ramda/src/anyPass'
import both from 'ramda/src/both'
import chain from 'ramda/src/chain'
import cond from 'ramda/src/cond'
import drop from 'ramda/src/drop'
import endsWith from 'ramda/src/endsWith'
import filter from 'ramda/src/filter'
import flip from 'ramda/src/flip'
import gt from 'ramda/src/gt'
import head from 'ramda/src/head'
import ifElse from 'ramda/src/ifElse'
import includes from 'ramda/src/includes'
import isEmpty from 'ramda/src/isEmpty'
import length from 'ramda/src/length'
import lensProp from 'ramda/src/lensProp'
import map from 'ramda/src/map'
import match from 'ramda/src/match'
import path from 'ramda/src/path'
import pathSatisfies from 'ramda/src/pathSatisfies'
import pipe from 'ramda/src/pipe'
import prop from 'ramda/src/prop'
import set from 'ramda/src/set'
import split from 'ramda/src/split'
import startsWith from 'ramda/src/startsWith'
import T from 'ramda/src/T'
import tail from 'ramda/src/tail'
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
  readonly subscriptionFilters: string[]
  readonly logEvents: LogEvents
  readonly logLink?: string
}
type LogMessages = ReadonlyArray<LogMessage>

let lastFetch = new Date(0),
  whitelist: string[] = []

const
  { AWS_REGION, AccountId, ErrorMessage, ProjectKey, TopicArn, WhitelistParameterStorePath } = process.env,
  awsRegion = AWS_REGION || 'eu-west-1',
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
  groupMatch = (re: RegExp) =>
    pipe<string, string[], Option<string[]>>(
      match(re),
      ifElse(
        isEmpty,
        () => none,
        pipe<string[], string[], Option<string[]>>(
          tail,
          some
        )
      )
    ),
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
        JiraProjectKey: { DataType: 'String', StringValue: ProjectKey },
      },
    }).promise()

export const
  toStringFn = includes,
  toRegExpFn = pipe<string, any, any>(toRegExp, test),
  toJspathFn = (str: string) =>
    pipe<string, Option<string[]>, Option<string>, Option<any>, Option<any[]>, Option<number>, Option<boolean>, boolean>(
      groupMatch(/({[\s\S]+})/), // . doesn't match newlines, use [\s\S] instead
      optmap<string[], string>(head),
      optchain<string, any>((str: string) => optTryCatch(() => JSON.parse(str))),
      optmap<any, any[]>((message: any) => jspathApply(`.${str}`, message)),
      optmap<any[], number>(length),
      optmap<number, boolean>(flip(gt)(0)),
      optGetOrElse<boolean>(() => false)
    ),
  toWhitelistFn = cond([
    [ test(/^\/[^/]+\/[gimsuy]*$/), toRegExpFn ],
    [ both(startsWith('{'), endsWith('}')), toJspathFn ],
    [ T, toStringFn ],
  ]),
  getLogId = pipe<LogMessage, string, string[], string[], string>(
    path([ 'logEvents', 0, 'message' ]) as unknown as (x: LogMessage) => string,
    split('\t'),
    drop(1),
    head
  ),
  addLogLink = (m: LogMessage) =>
    set(lensProp('logLink'), `https://${awsRegion}.console.aws.amazon.com/cloudwatch/home?region=${awsRegion}#logsV2:log-groups/log-group/${m.logGroup.replace(/\//g, '$252F')}/log-events$3FfilterPattern$3D$2522${getLogId(m)}$2522`, m)

export const handler = (event: KinesisStreamEvent) =>
  getWhitelist()
    // .then(tap(console.log))
    .then(map(toWhitelistFn))
    .then((whitelistFns) => pipe<KinesisStreamEvent, KinesisStreamRecord[], LogMessages, LogMessages, LogMessages, LogMessages, Promise<SNS.Types.PublishResponse>[], Promise<SNS.Types.PublishResponse[]>>(
      prop<string, any>('Records'),
      chain(parseRecord),
      filter(pathSatisfies(anyPass(whitelistFns))([ 'logEvents', 0, 'message' ])) as unknown as (x: LogMessages) => LogMessages,
      map(addLogLink),
      tap((x) => console.log(`Found ${x.length} entries`)),
      map(publishLog),
      Promise.all.bind(Promise)
    )(event))
    // .then(tap(console.log))
    .then(() => 'OK')
    .catch(console.error)
