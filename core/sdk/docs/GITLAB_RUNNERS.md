# Gitlab runners

This document shows how to set up [Gitlab runners](https://docs.gitlab.com/runner/)
on a private machine, as an alternative to using the SaaS runners hosted by
GitLab.

The [Local runners](#local-runners) section shows how to set up runners on your
own machine, while the [GCloud runners](#gcloud-runners) section explains how
runners are managed in Google Cloud. In both cases a Gitlab registration token
is needed beforehand.

## Registration token

Access [GitLab Runner Authentication Token](https://eyeo.atlassian.net/wiki/spaces/DEVOPS/pages/59179948/GitLab+Runner+Authentication+Token)
for a step-by-step on how to get the token for your runner.

## Local runners

Setting up Gitlab runners locally allows jobs from the CI pipeline to run on a
local machine.

Gitlab runners can run at OS level or in a Docker container. This document only
covers the Docker run.

### Registering a runner

**Step 1**. Register a docker runner using the [registration token](#registration-token).
Example:

```sh
docker run --rm -it -v /srv/gitlab-runner/config:/etc/gitlab-runner gitlab/gitlab-runner register \
  --url "https://gitlab.com/" --registration-token <TOKEN> \
  --executor docker --docker-image "node:18-bullseye-slim" \
  --description "local test" --tag-list "local-test"
```

Press enter to accept all default options. A `config.toml` file should have been
created (or updated) in the `/srv/gitlab-runner/config` folder.

Refresh the CI/CD runners page to check that the registered runner appears
there.

It's important that the tags in `--tag-list` are different from the already
existing project runners, otherwise the CI job may run on someone else's
machine.

Editing `config.toml` can change default values, for instance the maximum amount
of concurrent jobs in the runner process. For details, please check the
[config.toml reference](https://docs.gitlab.com/runner/configuration/advanced-configuration.html).

Notes:

- On macOS, `/srv` needs to be changed to `/Users/Shared`. The same applies
to the commands below.
- On Apple Silicon architectures, the `--platform linux/amd64` option should
be added.
- These notes apply to the next steps as well.

**Step 2**. Register a docker-in-docker (dind) runner:

```sh
docker run --rm -it -v /srv/gitlab-runner/config:/etc/gitlab-runner gitlab/gitlab-runner register \
  --url "https://gitlab.com/" --registration-token <TOKEN> \
  --executor docker --docker-image "docker:24.0.5" --docker-privileged --docker-volumes "/certs/client" \
  --description "local test dind" --tag-list "local-test-dind"
```

**Step 3**. Start the runner process:

```sh
docker run -it -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock gitlab/gitlab-runner
```

### Running CI jobs locally

**Step 1**. Add tags to `.gitlab-ci.yml`:

By default, the jobs defined in `.gitlab-ci.yml` run on SaaS runners hosted by
Gitlab. Adding `tags` to any job will make it run on any registered runner with
such tags. Example:

```yaml
build:
  ...
  tags:
    - local-test

func:v3:chromium:latest:
  ...
  tags:
    - local-test-dind
```

**Step 2**. Trigger the CI pipeline.

The tagged jobs should now run on the local machine.

### Debugging a local runner

#### docker exec

`docker exec` can be used to run any command into a running container.

Now, the containers where CI jobs run get automatically deleted after the job
has finished running. Gitlab has an [open issue to improve that behaviour](https://gitlab.com/gitlab-org/gitlab-runner/-/issues/3605).

To artificially keep the container running, `sleep` can be used as the last
script command. Example:

```yaml
func:v3:chromium:latest:
  ...
  script:
    - docker build -t functional-local -f test/dockerfiles/functional.Dockerfile --build-arg BROWSER="$BROWSER" --build-arg SKIP_BUILD=1 .;
    - sleep 600
  tags:
    - local-test-dind
```

Once the job is triggered we want to get the corresponding container id:

```sh
docker ps

CONTAINER ID   IMAGE                  COMMAND                  CREATED             STATUS             PORTS           NAMES
3178d4d6fad9   2b564bb4cc4b           "dockerd-entrypoint.…"   33 seconds ago      Up 32 seconds      2375-2376/tcp   runner-zegkjgxu-project-22365241-concurrent-0-a8b0105dc4903063-build
a76adec7b47f   2b564bb4cc4b           "dockerd-entrypoint.…"   43 seconds ago      Up 42 seconds      2375-2376/tcp   runner-zegkjgxu-project-22365241-concurrent-0-a8b0105dc4903063-docker-0
75b666c6ab7e   gitlab/gitlab-runner   "/usr/bin/dumb-init …"   About an hour ago   Up About an hour                   gifted_leakey
```

We need the id of the container named `...-docker-0` to execute commands:

```sh
docker exec -it <CONTAINER ID> <COMMAND>
```

For instance, we could run `docker run` inside that container:

```sh
docker exec -it a76adec7b47f docker run -e TEST_PARAMS="v3 chromium --testKinds reload" functional-local
```

#### Interactive web terminal

Gitlab offers [interactive web terminals](https://docs.gitlab.com/ee/ci/interactive_web_terminal/).
Potentially, any machine hosting self-managed runners could be configured to
allow that service. That needs further investigation.

## GCloud runners

Managing Gitlab runners in Google Cloud consists of creating remote virtual
machines (VMs) that end up being registered as CI project runners.

### Prerequisites

The following software needs to be installed locally:

- [terraform](https://developer.hashicorp.com/terraform/install?product_intent=terraform)
- [gcloud CLI](https://cloud.google.com/sdk/docs/install)

### Permissions

Authenticate in gcloud:

```sh
gcloud auth login
```

Then make sure you have access to the [google cloud console][gcloud-console].

For reference, a project called `eyeo-ee-runner-sandbox` was previously created
and the Compute Engine API was enabled for that project.

### Terraform config

Terraform is used to interact with GCloud in order to create the VM instances.

First of all, the [terraform-gitlab-runner-compute-instance project](https://gitlab.com/eyeo/adblockplus/abc/terraform-gitlab-runner-compute-instance)
needs to be cloned.

`terraform/main.tf` holds the relevant configuration. Inside, the module
`custom_gitlab_runner_config` defines all custom settings used for this runner
setup, including the following properties:

- `gitlab_worker_instance_type` sets the kind of machine that will be created.
- `gitlab_runner_concurrency` holds the number of gitlab-runner worker machines
that will be created.
- `gitlab_runner_version` holds the gitlab-runner version.
- `gitlab_worker_idle_time` sets the idle time (in seconds) before runners are
stopped and removed.

GCloud provides a set of [general-purpose-machines](https://cloud.google.com/compute/docs/general-purpose-machines#e2_machine_types_table),
for instance `e2-standard-2`. Custom machines can also be defined, as explained
in the [terraform argument reference](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_instance#machine_type).
Regarding disk size, property `gitlab_runner_disk_size` sets the size in GB.
The current setup defaults to 20GB per gitlab worker instance.

More options are available [here](https://gitlab.com/eyeo/devops/terraform/modules/terraform-google-gitlab-runner-autoscaler)

### Applying changes to GCloud

After configuring the project, terraform commands must be executed inside the
`terraform` folder:

```sh
# Exports the Gitlab token to avoid typing it manually on terraform commands
# See the registration token section for how to get one
export TF_VAR_gitlab_token=<TOKEN>

# Downloads needed resources into "terraform/.terraform"
terraform init

# Shows what is going to be applied to GCloud (without applying it)
terraform plan

# Applies changes to GCloud, creates/updates/removes VM instances
terraform apply -auto-approve

# Destroys all the infrastructure previously created
terraform destroy -auto-approve
```

After `terraform apply` new runners should appear in the [Runners settings][runners-settings].

### SSH connection to VM instances

The name and status of the VMs can be checked on the [google cloud console][gcloud-console].
With that information it is possible to do ssh connections to the VMs:

```sh
# Connect to the created machine
gcloud compute ssh <VM_NAME> --tunnel-through-iap --project=eyeo-ee-runner-sandbox

# Become root in that machine
sudo su

# Check the existing gitlab runner config
cat /etc/gitlab-runner/config.toml

# System monitoring tool, ctrl+c to exit
htop
```

[gcloud-console]: https://console.cloud.google.com/compute/instances?referrer=search&project=eyeo-ee-runner-sandbox
[runners-settings]: https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/settings/ci_cd#js-runners-settings
