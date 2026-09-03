# Docker Swarm, because there is one machine

Production is a single Hostinger KVM 2: 8 GB of RAM, 2 vCPU. It runs the application stack —
Traefik, MariaDB, the API, the front, the static server, the backup job, RabbitMQ, RustFS and
the vision worker — alongside staging and an observability stack of Prometheus, Loki, Promtail
and Grafana. Swarm is what schedules all of it.

The alternative that gets suggested is Kubernetes, usually k3s. It is refused here for reasons
that have nothing to do with capability. Swarm reads the same vocabulary as the `compose-dev.yaml`
used on the laptop, so one file describes a service from development to production; Traefik
integration and load balancing across replicas are a handful of labels rather than a set of
resources; and a control plane costs memory that this host would rather spend on the workload.
The honest addition is that nobody here has operated Kubernetes, and picking it would mean
learning an orchestrator to solve a problem that does not exist yet.

That last point is the one worth being explicit about, because it will read as the weakest in
two years. It is also the accurate one: Swarm's ceiling has not been reached, so the migration
would buy nothing today except familiarity with a tool used elsewhere.

## Consequences

Production, staging and the observability stack share one kernel, one disk and one memory
budget. A staging deploy that leaks or a vision worker that runs hot is a production incident.
The deploy jobs guard against the worst of it by sharing a single `concurrency` group
(`mawster-deploy`, `cancel-in-progress: false`), so production and staging can never converge on
the machine at the same moment — see ADR 0007 for the rest of the promotion chain.

Swarm gets no new features and its ecosystem has thinned; troubleshooting means older
documentation and fewer people who have hit the same problem. Rolling updates, secrets and
health checks all work, which is the full extent of what is asked of it.

The exit condition is a second machine, not a change of fashion. The day the workload needs more
than one node — or needs to survive that node — the reasons above stop holding and the question
reopens. Reversing this touches `stack-app.yaml`, `stack-app-staging.yaml`, `stack-app-dev.yaml`,
the secret plumbing in `run.sh`, and the deploy jobs that shell into the host.
