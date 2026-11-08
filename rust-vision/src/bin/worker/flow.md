```mermaid
flowchart TD
    ra(rabbit) -->|prefetch fetcher vision job| fe(fetcher)
    s3(rustfs) -->|download image| fe(fetcher)
    fe -->|channel inference| in{Infer thread}
    in -->|channel publish| pu(publisher)
    pu -->|push results json| s3
    pu -->|ack vision job && publish results job| ra
```