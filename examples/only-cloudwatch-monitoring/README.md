# Only CloudWatch example

This is an excellent option if you want to get notified when an error has been logged in an AWS Lambda, but it's not critical the the alert contains the actual log message.

Simple, cheap, and robust solution.

1. `cp config-cloudwatch.{template,sh}`
1. Edit `config-cloudwatch.sh`, only variables with `[VALUE]` need to be populated
1. `./deploy-all.sh ./path/to/config-cloudwatch.sh`
1. Make a copy of `lambda-alarms.template` for each lambda you want to monitor, and modify each copy appropriately
1. Execute each `lambda-alarms` copy

![overview](./img/overview.png)
