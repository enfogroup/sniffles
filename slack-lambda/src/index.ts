import { WebClient } from '@slack/web-api'
import { SNSEvent, SNSEventRecord, SNSMessage } from 'aws-lambda'
import { SSM } from 'aws-sdk'
// @ts-ignore
import __ from 'ramda/src/__'
import chain from 'ramda/src/chain'
import isNil from 'ramda/src/isNil'
import lensProp from 'ramda/src/lensProp'
import map from 'ramda/src/map'
import path from 'ramda/src/path'
import pipe from 'ramda/src/pipe'
import prop from 'ramda/src/prop'
import set from 'ramda/src/set'
// import tap from 'ramda/src/tap'
import when from 'ramda/src/when'
// import { inspect } from 'util'

interface MyMessage extends SNSMessage {
  MessageParsed: any
}

let lastFetch = new Date(0),
  slackToken = ''

const { SlackParameterStorePath, SlackChannel } = process.env,
  // logFull = (a: any) => console.log(inspect(a, { depth: Infinity })),
  ssm = new SSM(),
  messageParsedLens = lensProp('MessageParsed'),
  secondsAgo = (n: number) => new Date(new Date().valueOf() - n * 1000),
  getSlackToken = () =>
    lastFetch < secondsAgo(60)
      ? ssm.getParameter({ Name: SlackParameterStorePath as string, WithDecryption: true }).promise()
        .then(path<string>([ 'Parameter', 'Value' ]))
        .then(when(
          isNil,
          () => Promise.reject(new Error('Slack parameter store value is empty'))
        ))
        .then((token: string) => {
          lastFetch = new Date()
          slackToken = token
          return slackToken
        })
      : Promise.resolve(slackToken),
  getSlackClient = (token: string) =>
    new WebClient(token),
  addJsonParsedMessage = (m: SNSMessage): MyMessage =>
    pipe<SNSMessage, string, any, MyMessage>(
      prop('Message'),
      JSON.parse,
      set(messageParsedLens, __, m) as any
    )(m),
  sendToSlack = (slack: WebClient) => (content: MyMessage) =>
    slack.files.upload({
      channels: SlackChannel as string,
      content: JSON.stringify(content.MessageParsed, null, 2),
      initial_comment: content.Subject,
      filetype: 'javascript',
    })

export const handler = (event: SNSEvent) =>
  getSlackToken()
    .then(getSlackClient)
    .then((slack: WebClient) =>
      pipe<SNSEvent, SNSEventRecord[], SNSMessage[], MyMessage[], Promise<any>[], Promise<any[]>>(
        // tap(logFull),
        prop('Records'),
        chain(prop('Sns') as any),
        map(addJsonParsedMessage),
        map(sendToSlack(slack)),
        Promise.all.bind(Promise)
      )(event))
    .catch(console.error)
