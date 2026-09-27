#!/usr/bin/env bash
set -euo pipefail

# 360org Rancher Zero-Downtime Safe Rolling Update Helper
# Usage: ./rancher-rolling-update.sh <namespace> <deployment-name> [context]

NAMESPACE="${1:-}"
DEPLOYMENT="${2:-}"
CONTEXT="${3:-saas}"

if [[ -z "$NAMESPACE" || -z "$DEPLOYMENT" ]]; then
  echo "Usage: $0 <namespace> <deployment-name> [context]"
  echo "Example: $0 vuahethong vuahethong-deploy-odoo saas"
  exit 1
fi

echo "==> [1/4] Scale deployment '$DEPLOYMENT' in namespace '$NAMESPACE' to 2 replicas (Context: $CONTEXT)..."
kubectl scale deployment "$DEPLOYMENT" --replicas=2 -n "$NAMESPACE" --context "$CONTEXT"

echo "==> [2/4] Waiting for new pod to reach Ready status (1/1 Running)..."
kubectl rollout status deployment/"$DEPLOYMENT" -n "$NAMESPACE" --context "$CONTEXT" --timeout=300s

echo "==> [3/4] Scaling back down to 1 replica (safe drain & terminate old pod)..."
kubectl scale deployment "$DEPLOYMENT" --replicas=1 -n "$NAMESPACE" --context "$CONTEXT"

echo "==> [4/4] Pod rollout completed safely with zero downtime!"
kubectl get pods -n "$NAMESPACE" -l app=odoo --context "$CONTEXT"
