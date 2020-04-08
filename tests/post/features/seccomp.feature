@post @ci @local @seccomp
Feature: seccomp
    Scenario: Running a Pod with the 'runtime/default' seccomp profile works
        Given the Kubernetes API is available
        When we create a utils Pod with labels {'test': 'seccomp1'} and annotations {'seccomp.security.alpha.kubernetes.io/pod': 'runtime/default'}
        Then pods with label 'test=seccomp1' are 'Ready'
