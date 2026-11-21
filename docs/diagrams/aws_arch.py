import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gridiagram import Canvas
A = "aws/"
d = Canvas(1690, 915, "Serverless Auction Platform on AWS",
           "Three Serverless Framework services, one CloudFormation stack each, connected only through managed services")
d.legend(900, 40, [("default", "call"), ("write", "transactional write"), ("async", "event / async"),
                   ("fail", "failure path"), ("metric", "metrics")])

# outside
d.node("auth0", "saas/identity/auth0.png", "Auth0\nRS256 JWT", 80, 160)
d.node("users", A+"general/users.png", "Sellers and\nbidders", 80, 355)

# auth-service
d.group("auth-service", 225, 85, 190, 150, "purple")
d.node("authz", A+"compute/lambda.png", "auth λ\nverify JWT", 320, 150)

# auction-service
d.group("auction-service", 180, 255, 1300, 400, "orange")
d.node("api", A+"network/api-gateway.png", "REST API\nthrottled", 320, 355)
d.group("HTTP handlers", 395, 272, 150, 376, "white")
d.node("create", A+"compute/lambda.png", "createAuction", 455, 333)
d.node("get", A+"compute/lambda.png", "getAuction(s) · paged", 455, 418)
d.node("bid", A+"compute/lambda.png", "placeBid · conditional", 455, 503)
d.node("pic", A+"compute/lambda.png", "uploadPicture", 455, 588)
d.node("table", A+"database/dynamodb-table.png", "AuctionsTable\nGSI status+endingAt", 655, 415)
d.node("sched", A+"integration/eventbridge-scheduler.png", "Scheduler\none per auction", 815, 333)
d.node("sweep", A+"integration/eventbridge-rule.png", "Sweep rule\nevery 15 min", 815, 525)
d.node("cbi", A+"compute/lambda.png", "closeAuctionById", 975, 333)
d.node("proc", A+"compute/lambda.png", "processAuctions", 975, 525)
d.node("outbox", A+"database/dynamodb-table.png", "OutboxTable\nTTL 7 days", 1135, 415)
d.node("stream", A+"database/dynamodb-streams.png", "Stream\nINSERT filter", 1265, 415)
d.node("relay", A+"compute/lambda.png", "relayOutbox\nretry + bisect", 1395, 415)

# pictures
d.group("pictures (auction-service)", 180, 690, 520, 190, "orange")
d.node("cdn", A+"network/cloudfront.png", "CloudFront\norigin access control", 300, 775)
d.node("s3", A+"storage/simple-storage-service-s3-bucket.png", "S3 bucket\nall public access blocked", 575, 775)

# notification-service
d.group("notification-service", 735, 690, 745, 190, "green")
d.node("ses", A+"engagement/simple-email-service-ses.png", "SES\nseller + winner", 840, 775)
d.node("send", A+"compute/lambda.png", "sendMail\npartial batch failures", 1065, 775)
d.node("mq", A+"integration/simple-queue-service-sqs-queue.png", "MailQueue\n3 tries", 1240, 775)
d.node("dlq", A+"integration/simple-queue-service-sqs-queue.png", "DLQ\n14 days", 1395, 775)

# observability
d.group("observability", 1515, 255, 160, 625, "pink")
d.node("alarm", A+"management/cloudwatch-alarm.png", "4 alarms\nDLQ · age · relay", 1595, 415)
d.node("sns", A+"integration/simple-notification-service-sns-topic.png", "SNS\nauction-alerts", 1595, 600)
d.node("oncall", A+"general/user.png", "on-call\nemail", 1595, 775)

# edges: request path
d.edge("auth0", "users", "tokens", kind="async", route="v")
d.edge("users", "api", "HTTPS + JWT", route="h")
d.edge("api", "authz", "authorize", route="v", lpos=(320, 245))
for h in ("create", "get", "bid", "pic"):
    d.edge("api", h, route="hvh", mid=370)
for h in ("create", "get", "bid"):
    d.edge(h, "table", route="hvh", mid=570)
d.edge("create", "sched", "CreateSchedule at(endingAt)", route="h", lpos=(700, 333))
d.edge("sched", "cbi", "fires once", route="h")
d.edge("sweep", "proc", "safety net", route="h")
# the transaction: both closers write AuctionsTable and OutboxTable together
d.edge("cbi", "table", "TransactWriteItems\nCLOSED IF status = OPEN", kind="write",
       via=[(975, 415)], sides=("b", "r"), lpos=(815, 415))
d.edge("proc", "table", kind="write", via=[(975, 415)], sides=("t", "r"))
d.edge("cbi", "outbox", "+ email rows", kind="write", via=[(975, 415)], sides=("b", "l"), lpos=(1052, 415))
d.edge("proc", "outbox", kind="write", via=[(975, 415)], sides=("t", "l"))
d.edge("outbox", "stream", route="h")
d.edge("stream", "relay", route="h")
d.edge("relay", "mq", "SendMessage", kind="async", route="vhv", mid=675, lpos=(1318, 675))
d.edge("mq", "send", "poll, batch 1", kind="async", route="h")
d.edge("send", "ses", "SendEmail", route="h")
d.edge("mq", "dlq", "after 3 tries", kind="fail", route="h")
d.edge("dlq", "alarm", "DLQ not empty", kind="fail", via=[(1495, 775), (1495, 430)], sides=("r", "l"), tp=15, lpos=(1495, 600))
d.edge("relay", "alarm", "lag, failures", kind="metric", route="h", tp=-8)
d.edge("alarm", "sns", route="v")
d.edge("sns", "oncall", "email", route="v")
# pictures
d.edge("users", "cdn", "picture URLs", kind="async", via=[(80, 775)], sides=("b", "l"), lpos=(150, 775))
d.edge("cdn", "s3", "SigV4 GetObject", route="h")
d.edge("pic", "s3", "PutObject", via=[(575, 588)], sides=("r", "t"), lpos=(575, 650))
d.save(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "img", "aws-architecture"))
