#!/bin/sh

# The stack name suffix will get appended to the cloudformation stacks deployed by this script.
STACK_NAME_SUFFIX=""

# The Opsgenie CloudWatch endpoint.
# Leave empty to disable Opsgenie alerts.
# https://api.opsgenie.com/v1/json/amazonsns?apiKey=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CLOUDWATCH_OPSGENIE_ENDPOINT=""

# Slack workspace ID to send CloudWatch alarms to.
SLACK_WORKSPACE_ID=""

# Slack channel ID to send CloudWatch alarms to.
# Leave empty to disable alerts to Slack.
SLACK_CHANNEL_ID=""

# CloudWatch alarms
EVALUATION_PERIODS="1"

# CloudWatch alarms
DATAPOINTS_TO_ALARM="1"

# Project name
PROJECT=""

# jira project key
PROJECT_KEY=""

# jira ticket
SETUP_REQUEST=""

# e.g. Dev, Test, Production
ENVIRONMENT=""

# e.g. Weekday, 24/7
SLA="Weekday"

FULL_STACK_NAME_CLOUDWATCH="Sniffles-Cloudwatch-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_OPSGENIE_CLOUDWATCH="Sniffles-Opsgenie-Cloudwatch-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_CHATBOT="Sniffles-Chatbot-$STACK_NAME_SUFFIX"

# Topic
aws cloudformation deploy \
  --stack-name "$FULL_STACK_NAME_CLOUDWATCH" \
  --template-file ./cloudformation-templates/topic.yml \
  --no-fail-on-empty-changeset \
  --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/

OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$FULL_STACK_NAME_CLOUDWATCH" --query "Stacks[0].Outputs" --output json | jq -r '.[] | [.OutputKey, .OutputValue] | "\(.[0])=\(.[1])"')
eval $OUTPUTS

# Opsgenie
aws cloudformation deploy \
  --stack-name "$FULL_STACK_NAME_OPSGENIE_CLOUDWATCH" \
  --template-file ./cloudformation-templates/opsgenie.yml \
  --parameter-overrides SnsTopic="$SnsTopic" OpsgenieEndpoint="$CLOUDWATCH_OPSGENIE_ENDPOINT" \
  --no-fail-on-empty-changeset \
  --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/

# Chatbot
aws cloudformation deploy \
  --stack-name "$FULL_STACK_NAME_CHATBOT" \
  --template-file ./cloudformation-templates/chatbot.yml \
  --parameter-overrides SnsTopic="$SnsTopic" SlackChannelId="$SLACK_CHANNEL_ID" SlackWorkspaceId="$SLACK_WORKSPACE_ID" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/

echo "SNS Topic ARN: ${SnsTopic}"

