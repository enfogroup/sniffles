/* global describe, expect, it, jest */
import { handler, addLogLink, getLogId, toStringFn, toRegExpFn, toJspathFn, toWhitelistFn } from '../src/index'

describe('index', () => {
  const testMessage = {
    messageType: 'DATA_MESSAGE',
    owner: '300226469746',
    logGroup: '/aws/lambda/ncp-external-user-authority-service-prod-authority-user-get',
    logStream: '2020/07/01/[$LATEST]b29ea01d48a04a6f89b4ec8ecb39ce90',
    subscriptionFilters: [
      'LogsToKinesis',
    ],
    logEvents: [
      {
        id: '35538432368506835454249244686440411424098041279115624449',
        timestamp: 1593598422480,
        message: '2020-07-01T10:13:42.480Z\t69b3654a-89b8-453a-b42c-bb66ccfc6405\tINFO\t{\n  "@timestamp": 1593598422480,\n  "level": "ERROR",\n  "message": "Error while querying EPNCM",\n  "host": "nqa6wog2ua.execute-api.eu-west-1.amazonaws.com",\n  "verb": "GET",\n  "path": "/v1/authority/9717743247",\n  "useragent": "Amazon CloudFront",\n  "query": {\n    "explicit": "true"\n  },\n  "awsRequestId": "69b3654a-89b8-453a-b42c-bb66ccfc6405",\n  "functionName": "ncp-external-user-authority-service-prod-authority-user-get",\n  "invokedFunctionArn": "arn:aws:lambda:eu-west-1:300226469746:function:ncp-external-user-authority-service-prod-authority-user-get",\n  "memoryLimitInMB": "1024",\n  "remainingTime": 23904,\n  "error": {\n    "name": "ResponseError",\n    },\n  }\n',
      },
    ],
  }
  describe('handler', () => {
    it('handler should be a function', () => {
      expect(typeof handler).toBe('function')
    })
  })
  describe('getLogId', () => {
    it('works', () => {
      expect(getLogId(testMessage)).toEqual('69b3654a-89b8-453a-b42c-bb66ccfc6405')
    })
  })
  describe('addLogLink', () => {
    it('works', () => {
      expect(addLogLink(testMessage).logLink).toEqual('https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fncp-external-user-authority-service-prod-authority-user-get/log-events$3FfilterPattern$3D$252269b3654a-89b8-453a-b42c-bb66ccfc6405$2522')
    })
  })
  describe('toStringFn', () => {
    it('tests positive', () => {
      expect(toStringFn('abc')('x\ty\tabcd')).toBe(true)
    })
    it('tests negative', () => {
      expect(toStringFn('abc.*')('x\ty\tabc')).toBe(false)
    })
  })
  describe('toRegExpFn', () => {
    it('tests positive', () => {
      expect(toRegExpFn('/abc$/')('x\ty\tabc')).toBe(true)
    })
    it('tests negative', () => {
      expect(toRegExpFn('/abc$/')('x\ty\tabd')).toBe(false)
    })
  })
  describe('toJspathFn', () => {
    it('tests positive', () => {
      expect(toJspathFn('{ .level === "ERROR" }')(`x\ty\t${JSON.stringify({ level: 'ERROR' }, null, 2)}\n`)).toBe(true)
    })
    it('tests negative', () => {
      expect(toJspathFn('{ .level === "ERROR" }')(`x\ty\t${JSON.stringify({ level: 'INFO' }, null, 2)}\n`)).toBe(false)
    })
    it('handles not JSON', () => {
      expect(toJspathFn('{ .level === "ERROR" }')('x\ty\tblablabla')).toBe(false)
    })
  })
  describe('toWhitelistFn', () => {
    it('returns correct function', () => {
      expect.assertions(3)
      expect(toWhitelistFn('/abc$/')('x\ty\tabc')).toBe(true)
      expect(toWhitelistFn('{ .level === "ERROR" }')(`x\ty\t${JSON.stringify({ level: 'ERROR' }, null, 2)}\n`)).toBe(true)
      expect(toWhitelistFn('abc')('easy\tas\tabc')).toBe(true)
    })
  })
})
