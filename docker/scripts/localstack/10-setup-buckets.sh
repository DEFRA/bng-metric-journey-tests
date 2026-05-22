#!/bin/bash

# S3 bucket for virus-scanned baseline file uploads (used by cdp-uploader)
aws --endpoint-url=$LOCALSTACK_URL s3 --region $AWS_REGION mb s3://baseline-files

# S3 quarantine bucket — cdp-uploader stores all uploads here before ClamAV scan
aws --endpoint-url=$LOCALSTACK_URL s3 --region $AWS_REGION mb s3://cdp-uploader-quarantine

# SQS queues required by cdp-uploader
aws --endpoint-url=$LOCALSTACK_URL sqs --region $AWS_REGION create-queue \
  --queue-name cdp-clamav-results

aws --endpoint-url=$LOCALSTACK_URL sqs --region $AWS_REGION create-queue \
  --queue-name cdp-uploader-scan-results-callback.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true

aws --endpoint-url=$LOCALSTACK_URL sqs --region $AWS_REGION create-queue \
  --queue-name cdp-uploader-download-requests

# Queue polled by the mock-clamav listener (used when MOCK_VIRUS_SCAN_ENABLED=true)
aws --endpoint-url=$LOCALSTACK_URL sqs --region $AWS_REGION create-queue \
  --queue-name mock-clamav

# S3 event notification: quarantine bucket → mock-clamav queue
QUEUE_ARN=$(aws --endpoint-url=$LOCALSTACK_URL sqs --region $AWS_REGION get-queue-attributes \
  --queue-url $LOCALSTACK_URL/000000000000/mock-clamav \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

aws --endpoint-url=$LOCALSTACK_URL s3api --region $AWS_REGION put-bucket-notification-configuration \
  --bucket cdp-uploader-quarantine \
  --notification-configuration "{
    \"QueueConfigurations\": [{
      \"QueueArn\": \"$QUEUE_ARN\",
      \"Events\": [\"s3:ObjectCreated:*\"]
    }]
  }"
