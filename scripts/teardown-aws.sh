#!/usr/bin/env bash
# Remove everything deployed by deploy-aws.sh. The bucket must be empty before CloudFormation can delete it.
#   bash scripts/teardown-aws.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
STAGE="${STAGE:-dev}"; REGION="${REGION:-us-east-1}"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKET="auctions-$ACCOUNT-$STAGE"
read -r -p "Delete stage '$STAGE' in $REGION (account $ACCOUNT), including bucket $BUCKET and table AuctionsTable-$STAGE? Type the stage name: " ans
[ "$ans" = "$STAGE" ] || { echo "cancelled"; exit 1; }
aws s3 rm "s3://$BUCKET" --recursive --region "$REGION" 2>/dev/null || true
for s in auction-service notification-service auth-service; do
  echo "== remove $s"; (cd "$s" && npx serverless remove --stage "$STAGE" --region "$REGION")
done
echo "Done. Check the Billing console tomorrow: cost should stay at zero."
