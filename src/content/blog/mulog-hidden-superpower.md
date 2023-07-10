---
title:       "µ/log hidden superpower"
description: "This post illustrates how we used *μ/log* to automatically generate
AWS policy documents for our services."
publishDate: 2023-07-09
categories:  ["observability"]
tags:        ["µ/log", "AWS", "Clojure", "logging", "tracing", "monitoring", "observability"]
author:      Bruno Bonacci
---

> TL;DR \
> How we used *μ/log* to automatically generate
> AWS policy for Terraform.
>

### Intro

Since I developed [***μ/log***](https://github.com/BrunoBonacci/mulog) back in 2019, I
have consistently used it in every project I have worked on. My colleagues have
also embraced the idea and adopted it. We have integrated ***μ/log*** into every
microservice, lambda function, data-processing job, and larger service we have
developed. We publish the metrics to various systems such as
[Elasticsearch](https://www.elastic.co/enterprise-search), [AWS CloudWatch
Logs/Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html),
and [Jaeger Tracing](https://www.jaegertracing.io/) for later analysis.

***μ/log*** is a data logging system that goes beyond traditional log systems like
[log4j](https://logging.apache.org/log4j/), [logback](https://logback.qos.ch/),
and [Java Logging](https://docs.oracle.com/en/java/javase/11/core/java-logging-overview.html).
While those systems are designed to log simple sentences like `INFO: Server
started"`, `"INFO: Order received"` or `"ERROR: Payment failed"`, ***μ/log*** is designed
to capture data with a rich context. It provides detailed information such as
which server started, on which machine, and which version; which order was
received from which client, and if the payment failed, the reason, amount, and
associated order. It even tracks the processing time for each operation and more.

While traditional loggers like log4j primarily target human consumers, ***μ/log***
events are designed to be consumed by machines. In modern systems composed of
hundreds or thousands of microservices, it is impossible for humans to make
sense of the huge amound of text-based messages alone.
Software is necessary to sift through hundreds of millions or billions of events to
find the desired information.

The surprising outcome of our use of ***μ/log*** was that, for the first time in my
over 30 years of experience of developing and running systems, non-technical
individuals within our project were able to identify issues in test and
production systems without requiring developer intervention. This realization
highlighted the effectiveness of our observability approach.

From time to time, I come across new and amazing ways to utilize ***μ/log***. Today, I
want to share another use-case made possible by ***μ/log***'s data capture
capabilities.

Most of our work at [Redefine](https://redefine.io/) is based on AWS cloud. We
firmly believe in adhering to cloud best practices such as the [Principle of least Privilege](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege)
for our services. Consequently, we strive to avoid using
wildcards in our IAM Policies. While it is not difficult to manually craft a
policy for a tiny AWS Lambda or a small microservice that uses 2-3 services, it
becomes a non-trivial task when deploying larger microservices with numerous
components.

This post illustrates how we leveraged ***μ/log*** to automatically generate AWS
policy documents for our services.

### ***μ/log*** Instrumentation

At [Redefine](https://redefine.io/), I have instrumented our core AWS library
with ***μ/log*** to track various metrics for our AWS requests. Our core AWS library
wraps the excellent [Cognitect's aws-api](https://github.com/cognitect-labs/aws-api) and incorporates internal
features and patterns used throughout our platform and services.

The general usage is similar to the Cognitect's aws-api library:

```clojure
;; create a client for S3
(def s3 (make-client cfg :s3))

;; To Invoke an operation the general form is:
;; (invoke client operation request)
(invoke s3 :GetObject {:Bucket "redefine-test" :Key "some-object.dat"})
```

Our internal `invoke` function looks like this:

```clojure
(defn invoke
  "Invokes an AWS request and returns the result.
   Errors are contained within the result"
  [client operation request]
  (let [req {:op operation :request request}]
    (μ/trace :aws/request
      {:pairs   [:api       (service client)
                 :operation operation
                 :request   request]
       :capture (fn [response]
                  (when (anomaly? response)
                    {:mulog/outcome :error
                     :exception (anomaly-reason response)}))}
      (aws/invoke client req))))
```

Which produces the following event:

```clojure
{:mulog/event-name :aws/request,
 :mulog/timestamp  1688907460929,
 :mulog/trace-id   #mulog/flake "4r-oNlJf6rHAs7mGiLb2p0aroteHz5OR",
 :mulog/root-trace #mulog/flake "4r-oNlJf6rHAs7mGiLb2p0aroteHz5OR",
 :mulog/duration   109400167,
 :mulog/namespace  "user",
 :mulog/outcome    :ok,
 :api              :s3,
 :operation        :GetObject,
 :request          {:Bucket "redefine-test",
                    :Key    "some-object.dat"}}
```

- Line 1: Indicates that this is an `:aws/request` event.
- Line 2: Provides the timestamp when the request was initiated.
- Line 5: Indicates the duration of the request in nanoseconds.
- Line 7: Specifies whether the request was successful or if it failed. In case of an error, additional details are available in `:exception`.
- Line 8: Specifies the AWS service that was used.
- Line 9: Identifies the operation that was performed.
- Lines 10-11: Provide the details of the actual request made, including the AWS resource used.

It is remarkable how much information can be obtained from a single ***μ/log***
instrumentation. With this setup, we gain a wealth of information for each
request performed on every service.

While our actual implementation is more involved, as it allows tracing
activation at the service/operation/request level and collects additional
parameters, the overall idea remains the same.


### Extracting the AWS Information

To generate a policy for one of our services, we simply run our battery of
automated tests and instruct ***μ/log*** to write all the events to a file.

We start ***μ/log***'s publisher and configure it to write the events to a file on our disk:

```clojure
(require '[com.brunobonacci.mulog :as μ])
(def pub (μ/start-publisher!
           {:type :simple-file
            :filename "/tmp/mulog/events.edn"}))
```


The next step is to run the tests for the service from which we want to extract
the policy. The tests can be executed against
[LocalStack](https://localstack.cloud/) or an AWS test account; it doesn't
matter. Once the test execution is complete, we have all the data required to
automatically generate our policy.


### Extracting the Operations

The first step is to parse the [EDN](https://github.com/edn-format/edn) file and
load the events:

```clojure
(defn parse-file
  [file]
  (->> file
    slurp
    str/split-lines
    (map (partial edn/read-string {:default tagged-literal}))
    (filter (where :mulog/event-name :is? :aws/request))))
```


The expression `(where :mulog/event-name :is? :aws/request)` returns a predicate
function that evaluates to true if the event is a `:aws/request`. I developed a
small library called [where](https://github.com/BrunoBonacci/where) to make
predicate functions easier to be read and understood by humans.

When we execute `parse-file`, we obtain the events as Clojure maps:

```clojure
(parse-file "/tmp/mulog/events.edn" )
;; => ({:mulog/event-name :aws/request,
;;     :mulog/timestamp  1688907460929,
;;     :mulog/trace-id   #mulog/flake "4r-oNlJf6rHAs7mGiLb2p0aroteHz5OR",
;;     :mulog/root-trace #mulog/flake "4r-oNlJf6rHAs7mGiLb2p0aroteHz5OR",
;;     :mulog/duration   109400167,
;;     :mulog/namespace  "user",
;;     :mulog/outcome    :ok,
;;     :api              :s3,
;;     :operation        :GetObject,
;;     :request          {:Bucket "redefine-test",
;;                        :Key    "some-object.dat"}}
;;     ...
;;    )
```


To generate an AWS Policy, we need to extract the following fields:
- The AWS service used, indicated by the `:api` key in our event.
- The operation performed, indicated by the `:operation` key.
- Finally, we need to determine the targeted resource.

While the first two steps are straightforward, determining the resource requires a little more thought. The location of the resource in use differs for each operation type.

For each event, we generate the following result:

```clojure
{:api :s3, :action :GetObject :resource "redefine-test"}
```

So we encode such information in a nested map and extract the opertaions:

```clojure
(def resource
  {:dynamodb    {:Query         :TableName
                 :GetItem       :TableName}
   :s3          {:GetObject     :Bucket
                 :PutObject     :Bucket
                 :ListObjectsV2 :Bucket}})

(defn extract-operations
  [aws-events]
  (->> aws-events
    (mapcat
      (fn [{:keys [api operation request]}]
        (let [resource-lookup (get-in resource [api operation] (constantly nil))
              resources       (resource-lookup request)]
          (if (sequential? resources)
            (map (fn [p] (merge {:api api :action operation} p)) resources)
            [{:api api :action operation :resource resources}]))))
    (distinct)
    (sort-by (juxt :api :action :resource))))
```


Some operations, like DynamoDB's `TransactWriteItems`, bundle multiple other
operations that need to be included individually in the policy. Other
operations, such as DynamoDB's `BatchGetItem`, can target multiple
resources. Thus, in the resource map, instead of providing a keyword to extract
the resource, we can provide a Clojure function to extract the required actions.

In just a few lines of code, we obtain the list of operations performed by our
microservice along with the resource information:

```clojure
(->> file
  parse-file
  extract-operations)
;; =>({:api :dynamodb, :action :GetItem, :resource "table1"}
;;    {:api :dynamodb, :action :PutItem, :resource "table1"}
;;    {:api :dynamodb, :action :Query,   :resource "table1"}
;;    {:api :dynamodb, :action :UpdateItem, :resource "table2"}
;;    {:api :s3, :action :GetObject, :resource "redefine-test"}
;;    {:api :s3, :action :ListObjectsV2, :resource "redefine-test"}
;;    {:api :s3, :action :PutObject, :resource "redefine-test"})
```

Pretty cool 😎!

AWS policies require the resource to be expressed in ARN formatwhile in most
requests, the resource is specified by a simple name. Therefore, we need to
expand short names to AWS ARNs:

```clojure
(defn resources->arn
  [region account operations]
  (->> operations
    (map
      (fn [{:keys [api resource] :as op}]
        (assoc op :resource
          (if (str/starts-with? resource "arn:")
            resource
            (case api
              :dynamodb    (format "arn:aws:dynamodb:%s:%s:table/%s"
                             region account resource)
              :s3          (format "arn:aws:s3:::%s" resource)
              :eventbridge (format "arn:aws:events:%s:%s:event-bus/%s"
                             region account resource)
              resource)))))))
```


Now we have the full resource name in ARN format:

```clojure
(->> file
  parse-file
  extract-operations
  (resources->arn "eu-west-1" "123456789012"))
;;  ...
;;     {:api :s3,
;;      :action :GetObject,
;;      :resource "arn:aws:s3:::redefine-play-reclogs"}
;;     {:api :s3,
;;      :action :GetObject,
;;      :resource "arn:aws:s3:::redefine-test"}
;;     {:api :s3,
;;      :action :ListObjectsV2,
;;      :resource "arn:aws:s3:::redefine-test"}
;;     {:api :s3,
;;      :action :PutObject,
;;      :resource "arn:aws:s3:::redefine-test"})
```


That's all we need to generate a policy.

### Generating the policy

The final step is to generate a valid Policy document. A policy groups
permissions by resource. We add the following function to our pipeline:

```clojure
(defn- policy-statement
  [actions]
  {:actions (mapv (fn [{:keys [api action]}]
                    (str (name api) ":" (name action))) actions)
   :resources [(:resource (first actions))]})


(defn extract-policy
  ([operations-list]
   (extract-policy nil operations-list))
  ([policy-name operations-list]
   (->> operations-list
     (group-by :resource)
     (vals)
     (map policy-statement)
     ((fn [p]
        {:type "aws_iam_policy_document"
         :name (or policy-name "your-policy-document")
         :statements p})))))
```


At [Redefine](https://redefine.io/) we use [Terraform](https://www.terraform.io/) to manage our infrastructure using
*Infrastructure As Code* principles.

To produce the Terraform document we need a templating library,
for this project we use [clostache](https://github.com/fhd/clostache)
is a very simple library based on [Mustache format](https://mustache.github.io/mustache.5.html).

Here is the template we need:

```mustache
data "aws_iam_policy_document" "{{{name}}}" {

  {{#statements}}

  statement {
    actions = [
      {{#actions}}
      "{{.}}",
      {{/actions}}
    ]
    resources = ["{{#resources}}{{.}}{{/resources}}"]
  }
  {{/statements}}
}
```

Now we can render the policy we extracted in our previous steps:

```clojure
(defn render-terraform-policy-document
  [{:keys [type] :as policy}]
  (clo/render-resource (str "terraform-" type ".mustache") policy))


;; the final pipeline:
(->> file
  parse-file
  extract-operations
  (resources->arn "eu-west-1" "123456789012")
  (extract-policy)
  render-terraform-policy-document
  println)
```

And the final result is a Terraform policy 😎:

```hcl
data "aws_iam_policy_document" "your-policy-document" {


  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = ["arn:aws:dynamodb:eu-west-1:123456789012:table/table1"]
  }

  statement {
    actions = [
      "dynamodb:UpdateItem",
    ]
    resources = ["arn:aws:dynamodb:eu-west-1:123456789012:table/table2"]
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:ListObjectsV2",
      "s3:PutObject",
    ]
    resources = ["arn:aws:s3:::redefine-test"]
  }
}
```

### Conclusion

The integration of ***μ/log*** into our AWS services has proven to be an invaluable
asset. By capturing rich contextual data and generating detailed event logs,
***μ/log*** has empowered both technical and non-technical team members to gain deep
insights into the behavior of our systems. With ***μ/log***, we have achieved a level
of observability that enables quick issue identification and resolution, even
for individuals without deep technical expertise.

Furthermore, we have showcased how ***μ/log*** can be utilized to automatically
generate AWS IAM Policies for our services. By leveraging the captured data, we
extract the necessary information about AWS services, operations, and resources,
and transform it into a well-defined policy document. This automation not only
saves us time and effort but also ensures that our policies adhere to the
Principle of Least Privilege, bolstering the security of our infrastructure.

Overall, ***μ/log*** has revolutionized the way we approach observability and policy
generation in our AWS environment. Its ability to capture comprehensive data and
facilitate automated processes has significantly improved our efficiency and
reliability. We look forward to continuing our journey with ***μ/log*** and exploring
more innovative ways to leverage its capabilities in our microservices
architecture.
