#!/usr/bin/env python3
"""AWS architecture diagrams with the official AWS service icons.

    pip install diagrams     # also needs Graphviz: brew install graphviz
    python3 docs/diagrams/aws_diagrams.py

Writes docs/img/aws-architecture.png, aws-close-flow.png and aws-delivery.png.
The Mermaid atlas (docs/architecture.md) stays the detailed source; these are
the at-a-glance pictures.
"""
import os

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import Lambda
from diagrams.aws.database import DynamodbTable, DynamodbStreams
from diagrams.aws.engagement import SimpleEmailServiceSes
from diagrams.aws.general import Users, User
from diagrams.aws.integration import (EventbridgeScheduler, EventbridgeRule, SimpleQueueServiceSqsQueue,
                                      SimpleNotificationServiceSnsTopic)
from diagrams.aws.management import CloudwatchAlarm, Cloudformation, CloudformationStack
from diagrams.aws.network import APIGateway, CloudFront
from diagrams.aws.security import IdentityAndAccessManagementIamRole, IdentityAndAccessManagementIamAWSSts
from diagrams.aws.storage import SimpleStorageServiceS3
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.container import Docker
from diagrams.saas.identity import Auth0

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "img")
os.makedirs(OUT, exist_ok=True)

GRAPH = {"fontsize": "22", "fontname": "Helvetica", "pad": "0.4", "nodesep": "0.55", "ranksep": "0.9",
         "splines": "spline", "bgcolor": "white"}
NODE = {"fontsize": "12", "fontname": "Helvetica"}
EDGE = {"fontsize": "11", "fontname": "Helvetica", "color": "#545b64"}


def cluster(label, color):
    return Cluster(label, graph_attr={"bgcolor": color, "fontsize": "14", "fontname": "Helvetica-Bold",
                                      "pencolor": "#aab7b8", "style": "rounded", "margin": "18"})


def label(text, color="#545b64", style="solid"):
    return Edge(label=text, color=color, fontcolor=color, style=style)


# 1. The whole system ------------------------------------------------------------------------
with Diagram("Serverless Auction Platform on AWS", filename=os.path.join(OUT, "aws-architecture"),
             show=False, direction="LR", graph_attr=GRAPH, node_attr=NODE, edge_attr=EDGE, outformat="png"):
    users = Users("Sellers and\nbidders")
    idp = Auth0("Auth0\nRS256 JWT")

    with cluster("auth-service", "#f2f8fd"):
        authz = Lambda("auth\n(authorizer)")

    with cluster("auction-service", "#fdf7f0"):
        api = APIGateway("REST API\nthrottled: stage + bid")
        with cluster("HTTP handlers", "#ffffff"):
            create = Lambda("createAuction")
            reads = Lambda("getAuction(s)\npaged")
            bid = Lambda("placeBid\nconditional write")
            pic = Lambda("uploadPicture")
        sched = EventbridgeScheduler("Scheduler\none per auction")
        sweep = EventbridgeRule("sweep\nevery 15 min")
        close_by_id = Lambda("closeAuctionById")
        proc = Lambda("processAuctions")
        auctions = DynamodbTable("AuctionsTable\nGSI status+endingAt")
        outbox = DynamodbTable("OutboxTable\nTTL 7 days")
        stream = DynamodbStreams("stream\nINSERT only")
        relay = Lambda("relayOutbox")
        bucket = SimpleStorageServiceS3("pictures\nprivate bucket")
        cdn = CloudFront("CloudFront\norigin access control")

    with cluster("notification-service", "#f3fbf2"):
        queue = SimpleQueueServiceSqsQueue("MailQueue")
        dlq = SimpleQueueServiceSqsQueue("DLQ\n14 days")
        send = Lambda("sendMail\npartial batch failures")
        ses = SimpleEmailServiceSes("SES")

    with cluster("observability", "#fbf2f4"):
        alarms = CloudwatchAlarm("4 alarms\nDLQ · queue age ·\nrelay failures · lag")
        topic = SimpleNotificationServiceSnsTopic("auction-alerts")
        ops = User("on-call email")

    users >> label("HTTPS + Bearer JWT") >> api
    idp >> label("tokens", style="dashed") >> users
    api >> label("authorize") >> authz
    api >> [create, reads, bid, pic]
    [create, reads, bid] >> auctions
    create >> label("CreateSchedule at(endingAt)") >> sched >> close_by_id
    sweep >> proc
    [close_by_id, proc] >> label("TransactWrite\nCLOSED + emails", color="#c7511f") >> auctions
    [close_by_id, proc] >> label("same transaction", color="#c7511f", style="dashed") >> outbox
    outbox >> stream >> relay >> queue >> send >> ses
    queue >> label("after 3 tries", color="#b0084d", style="dashed") >> dlq
    pic >> bucket
    users >> label("picture URLs", style="dashed") >> cdn >> label("SigV4 GetObject") >> bucket
    [dlq, relay] >> label("metrics", style="dotted") >> alarms >> topic >> ops


# 2. Closing an auction: on time, once, and its emails never lost ---------------------------
with Diagram("Close an auction -> email, end to end", filename=os.path.join(OUT, "aws-close-flow"),
             show=False, direction="LR", graph_attr=GRAPH, node_attr=NODE, edge_attr=EDGE, outformat="png"):
    sched = EventbridgeScheduler("1  Scheduler fires\nat endingAt")
    sweep = EventbridgeRule("safety net\nsweep every 15 min")
    close = Lambda("2  closeAuctionById\n(or processAuctions)")
    with cluster("one DynamoDB transaction", "#fdf7f0"):
        auctions = DynamodbTable("AuctionsTable\nCLOSED IF status = OPEN")
        outbox = DynamodbTable("OutboxTable\n+1-2 email rows")
    stream = DynamodbStreams("3  stream\nINSERT filter")
    relay = Lambda("4  relayOutbox\nretries 10, bisect")
    fail = SimpleQueueServiceSqsQueue("relay-failures\nqueue")
    queue = SimpleQueueServiceSqsQueue("5  MailQueue")
    send = Lambda("6  sendMail")
    ses = SimpleEmailServiceSes("7  SES\nseller + winner")
    dlq = SimpleQueueServiceSqsQueue("MailQueue DLQ")
    alarm = CloudwatchAlarm("alarm -> SNS")

    sched >> close
    sweep >> label("missed ones", style="dashed") >> close
    close >> label("TransactWriteItems", color="#c7511f") >> auctions
    close >> label("", color="#c7511f") >> outbox
    outbox >> stream >> relay >> queue >> send >> ses
    relay >> label("gave up", color="#b0084d", style="dashed") >> fail >> alarm
    queue >> label("3 failed tries", color="#b0084d", style="dashed") >> dlq >> alarm


# 3. Build, test and deploy --------------------------------------------------------------------
with Diagram("Test at $0, deploy without keys", filename=os.path.join(OUT, "aws-delivery"),
             show=False, direction="LR", graph_attr=GRAPH, node_attr=NODE, edge_attr=EDGE, outformat="png"):
    dev = User("developer")
    with cluster("every push and PR", "#f2f8fd"):
        ci = GithubActions("e2e workflow\n31 checks")
        ls = Docker("LocalStack 3.5\n+ serverless-offline")
    with cluster("laptop, $0", "#f3fbf2"):
        lsd = Docker("deploy-localstack.sh\nreal stacks, 13 checks")
    with cluster("AWS account (when there is one)", "#fdf7f0"):
        cd = GithubActions("deploy workflow\nprod needs a reviewer")
        sts = IdentityAndAccessManagementIamAWSSts("STS\nOIDC token -> 1 h creds")
        role = IdentityAndAccessManagementIamRole("deploy role\nthis repo's dev/prod only")
        cfn = Cloudformation("CloudFormation")
        # Graphviz stacks siblings bottom-up here, so list them in reverse to read 1-2-3 top-down.
        stacks = [CloudformationStack("3 auction-service"), CloudformationStack("2 notification-service"),
                  CloudformationStack("1 auth-service")]

    dev >> ci >> ls
    dev >> lsd
    dev >> label("run workflow") >> cd >> sts >> role >> cfn >> stacks
