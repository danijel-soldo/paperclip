# Skill: local/57261fe21c/ansible-automation-openshift-power

---
name: ansible-automation-openshift-power
description: >
  Infrastructure automation and configuration management using Ansible for
  OpenShift on IBM Power systems. Covers PowerVC integration, network boot
  automation, service orchestration, and deployment patterns. Use for deploying
  applications, managing infrastructure services, and automating cluster
  provisioning on IBM Power platforms.
---

# Ansible Automation for OpenShift on IBM Power

## Overview

This skill captures patterns and best practices for automating OpenShift Container Platform deployment on IBM Power systems using Ansible, PowerVC, and HMC integration. It covers infrastructure provisioning, service orchestration, and configuration management for enterprise-grade deployments.

## When to Use

- Deploying OpenShift clusters on IBM Power/PowerVC
- Automating infrastructure services (DNS, DHCP, TFTP, HAProxy, HTTP)
- Managing LPAR lifecycle on Power systems
- Network boot automation via HMC
- Configuration management for complex multi-service deployments
- Infrastructure as Code for Power-based environments

## Core Concepts

### Deployment Architecture

**Bastion Host Pattern**
- Central infrastructure services host
- Runs DNS, DHCP, TFTP, HTTP, HAProxy, NFS
- Acts as PXE boot server and load balancer
- Single point of configuration management

**PowerVC Integration**
- IBM PowerVC as virtualization layer
- OpenStack API for VM lifecycle management
- Automated LPAR provisioning and networking
- Image and compute template management

**HMC Integration**
- Hardware Management Console for Power systems
- Network boot initiation for LPARs
- MAC address retrieval for DHCP configuration
- Power management operations

### Installation Methods

**Agent-Based Installation**
- Uses OpenShift Agent-based installer
- Creates bootable ISO with embedded ignition configs
- Suitable for disconnected/air-gapped environments
- Single-step deployment process

**Network-Based Installation**
- Traditional PXE/TFTP boot approach
- Requires network infrastructure services
- More flexible for large-scale deployments
- Multi-stage boot process (TFTP → HTTP → ignition)

## Ansible Best Practices

### Playbook Structure

**Modular Design**
```yaml
# Main orchestration playbook
- name: Deploy OpenShift Cluster
  import_playbook: cleanup.yaml
- name: Create Infrastructure
  import_playbook: create_bastion.yaml
- name: Provision Nodes
  import_playbook: create_nodes.yaml
# ... additional steps
```

**Benefits:**
- Single responsibility per playbook
- Reusable components
- Easy to test and maintain
- Clear execution flow

### Idempotency Patterns

**Resource Creation with Checks**
```yaml
- name: Query for existing resource
  openstack.cloud.server_info:
    filters:
      name: "{{ resource_name }}"
  register: server_info

- name: Determine if resource exists
  ansible.builtin.set_fact:
    resource_exists: "{{ (server_info.servers | default([])) | length > 0 }}"

- name: Create resource only if needed
  ibm.powervc.server:
    name: "{{ resource_name }}"
    # ... configuration
  when: not resource_exists
```

**Key Principles:**
- Always check before create
- Use declarative modules when possible
- Leverage Ansible's built-in idempotency
- Conditional execution based on state

### Configuration Management

**Centralized Variables**
```yaml
# vars/project_vars.yaml
services:
  DNS: True
  DHCP: True
  HAPROXY: True

bastion:
  name: bastion
  ip: 10.0.10.100
  image: RHEL960_Image

nodes:
  - name: master01
    ip: 10.0.10.30
    type: master
```

**Template-Driven Configuration**
```yaml
- name: Generate DHCP configuration
  template:
    src: dhcpd.conf.j2
    dest: /etc/dhcp/dhcpd.conf
  notify: Restart dhcpd
```

### Error Handling

**Wait Loops with Timeouts**
```yaml
- name: Wait for SSH connectivity
  ansible.builtin.wait_for_connection:
    timeout: 300
    delay: 5
    sleep: 5

- name: Wait for LPAR to become ACTIVE
  openstack.cloud.server_info:
    filters:
      name: "{{ lpar_name }}"
  register: lpar_status
  until: lpar_status.servers[0].status == "ACTIVE"
  retries: 60
  delay: 10
```

**Graceful Failure Handling**
```yaml
- name: Attempt operation
  command: risky_operation
  ignore_errors: true
  register: operation_result

- name: Handle failure
  debug:
    msg: "Operation failed, continuing with fallback"
  when: operation_result.failed
```

## PowerVC Integration Patterns

### LPAR Provisioning

**Using ibm.powervc.server Module**
```yaml
- name: Create LPAR
  ibm.powervc.server:
    auth:
      auth_url: https://powervc:5000/v3
      project_name: ibm-default
      username: root
      password: "{{ vault_password }}"
    name: "{{ lpar_name }}"
    image: "{{ rhcos_image }}"
    flavor: "{{ compute_template }}"
    network: "{{ network_name }}"
    nics:
      - network_name: "{{ network_name }}"
        fixed_ip: "{{ static_ip }}"
    key_name: "{{ ssh_keypair }}"
    validate_certs: false
    state: present
```

**Key Considerations:**
- Use static IP assignments for cluster nodes
- Specify compute templates (flavors) for consistent sizing
- Configure SSH keypair for access
- Set validate_certs appropriately for environment

### MAC Address Retrieval

**Dynamic MAC Collection**
```yaml
- name: Get LPAR details from PowerVC
  openstack.cloud.server_info:
    auth: "{{ powervc.auth }}"
    filters:
      name: "{{ lpar_name }}"
  register: lpar_info

- name: Extract MAC address
  set_fact:
    lpar_mac: "{{ lpar_info.servers[0].addresses[network_name][0]['OS-EXT-IPS-MAC:mac_addr'] }}"

- name: Build MAC mapping
  set_fact:
    mac_mappings: "{{ mac_mappings | default([]) + [{'name': lpar_name, 'mac': lpar_mac, 'ip': lpar_ip}] }}"
```

## Network Infrastructure Services

### DNS Configuration (BIND)

**Zone File Generation**
```jinja2
{# dnsname.db.j2 #}
$TTL 1W
@   IN  SOA ns1.{{ netdomain }}. root.{{ netdomain }}. (
        {{ ansible_date_time.epoch }}  ; serial
        3H      ; refresh
        1H      ; retry
        1W      ; expire
        1H )    ; minimum

    IN  NS  ns1.{{ netdomain }}.

ns1 IN  A   {{ bastion.ip }}

{% for node in nodes %}
{{ node.name }}  IN  A  {{ node.ip }}
{% endfor %}

api         IN  A  {{ bastion.ip }}
api-int     IN  A  {{ bastion.ip }}
*.apps      IN  A  {{ bastion.ip }}
```

**Service Setup Pattern**
```yaml
- name: Install BIND
  package:
    name: bind
    state: present

- name: Deploy zone files
  template:
    src: "{{ item.src }}"
    dest: "{{ item.dest }}"
    owner: root
    group: named
    mode: '0644'
  loop:
    - { src: 'named.conf.j2', dest: '/etc/named.conf' }
    - { src: 'dnsname.db.j2', dest: '/var/named/{{ netdomain }}.db' }
  notify: Restart named

- name: Enable and start named
  service:
    name: named
    enabled: yes
    state: started
```

### DHCP Configuration

**Static Reservations with PXE Boot**
```jinja2
{# dhcpd.conf.j2 #}
subnet {{ subnet }} netmask {{ subnetmask }} {
    option domain-name-servers {{ dns1 }}, {{ dns2 }};
    option domain-search "{{ netname }}.{{ netdomain }}";
    filename "boot/grub2/powerpc-ieee1275/core.elf";
    next-server {{ bastion.ip }};
    deny unknown-clients;
    
    {% for node in MAC_nodes %}
    host {{ node.name }}.{{ netname }}.{{ netdomain }} {
        hardware ethernet {{ node.mac }};
        fixed-address {{ node.ip }};
        option host-name "{{ node.name }}";
    }
    {% endfor %}
}
```

**Key Features:**
- Static IP reservations based on MAC addresses
- PXE boot configuration (next-server, filename)
- Deny unknown clients for security
- Infinite lease times for cluster nodes

### HAProxy Load Balancer

**OpenShift-Specific Configuration**
```jinja2
{# haproxy.cfg.j2 #}
frontend api-server
    bind *:6443
    mode tcp
    default_backend api-server-backend

backend api-server-backend
    mode tcp
    balance roundrobin
    {% for node in nodes if node.type in ['master', 'bootstrap'] %}
    server {{ node.name }} {{ node.ip }}:6443 check
    {% endfor %}

frontend machine-config
    bind *:22623
    mode tcp
    default_backend machine-config-backend

backend machine-config-backend
    mode tcp
    balance roundrobin
    {% for node in nodes if node.type in ['master', 'bootstrap'] %}
    server {{ node.name }} {{ node.ip }}:22623 check
    {% endfor %}

frontend ingress-http
    bind *:80
    mode tcp
    default_backend ingress-http-backend

backend ingress-http-backend
    mode tcp
    balance roundrobin
    {% for node in nodes if node.type == 'worker' %}
    server {{ node.name }} {{ node.ip }}:80 check
    {% endfor %}
```

## OpenShift Ignition Workflow

### Configuration Generation

**Install Config Template**
```yaml
- name: Generate install-config.yaml
  template:
    src: install-config.yaml.j2
    dest: "{{ install_config }}"

- name: Read SSH public key
  set_fact:
    ssh_pubkey: "{{ lookup('file', sshkey_file) }}"

- name: Inject SSH key
  lineinfile:
    path: "{{ install_config }}"
    regexp: 'SSHKEY'
    line: "    {{ ssh_pubkey }}"

- name: Read pull secret
  set_fact:
    secret_key: "{{ lookup('file', secret_file) | from_json | to_json }}"

- name: Inject pull secret
  replace:
    path: "{{ install_config }}"
    regexp: 'SECRET'
    replace: "{{ secret_key | to_json }}"
```

### Ignition File Creation

**Agent-Based Method**
```yaml
- name: Create agent-based ISO
  command:
    cmd: "openshift-install agent create image --log-level=info"
  args:
    chdir: ../

- name: Extract ignition from ISO
  shell: |
    set -o errexit -o pipefail
    coreos-installer iso ignition show agent.ppc64le.iso > agent.ign
  args:
    chdir: ../

- name: Extract PXE files
  command:
    cmd: "coreos-installer iso extract pxe agent.ppc64le.iso"
  args:
    chdir: ../
```

### File Distribution

**Copy to Infrastructure Services**
```yaml
- name: Copy ignition to web server
  copy:
    src: ../agent.ign
    dest: /var/www/html/
    owner: apache
    group: apache

- name: Copy kernel to TFTP
  copy:
    src: ../agent.ppc64le-vmlinuz
    dest: /var/lib/tftpboot/
    owner: root
    group: root

- name: Copy initramfs to TFTP
  copy:
    src: ../agent.ppc64le-initrd.img
    dest: /var/lib/tftpboot/
    owner: root
    group: root

- name: Copy rootfs to web server
  copy:
    src: ../agent.ppc64le-rootfs.img
    dest: /var/www/html/
    owner: apache
    group: apache
```

## HMC Network Boot

### Boot Initiation Pattern

**Using HMC REST API**
```yaml
- name: Set network boot device
  uri:
    url: "https://{{ hmc_host }}/rest/api/uom/ManagedSystem/{{ ms_id }}/LogicalPartition/{{ lpar_id }}"
    method: POST
    user: "{{ hmc_auth.username }}"
    password: "{{ hmc_auth.password }}"
    body_format: json
    body:
      BootMode: "network"
      BootDevice: "{{ network_interface }}"
    validate_certs: no

- name: Restart LPAR
  uri:
    url: "https://{{ hmc_host }}/rest/api/uom/LogicalPartition/{{ lpar_id }}/do/PowerOn"
    method: PUT
    user: "{{ hmc_auth.username }}"
    password: "{{ hmc_auth.password }}"
    validate_certs: no
```

## Security Best Practices

### Secrets Management

**Use Ansible Vault**
```bash
# Encrypt sensitive variables
ansible-vault encrypt vars/project_vars.yaml

# Run playbook with vault password
ansible-playbook playbook.yaml --ask-vault-pass

# Use vault password file
ansible-playbook playbook.yaml --vault-password-file ~/.vault_pass
```

**Separate Secrets from Code**
```yaml
# vars/project_vars.yaml
powervc:
  auth:
    auth_url: https://powervc:5000/v3
    username: root
    password: "{{ vault_powervc_password }}"

# vars/vault.yaml (encrypted)
vault_powervc_password: "actual_password"
vault_hmc_password: "actual_password"
vault_pull_secret: "actual_pull_secret"
```

### SELinux Configuration

**Proper SELinux Management**
```yaml
# Instead of disabling SELinux
- name: Set SELinux booleans for services
  seboolean:
    name: "{{ item }}"
    state: yes
    persistent: yes
  loop:
    - httpd_can_network_connect
    - named_write_master_zones

- name: Set SELinux contexts
  sefcontext:
    target: '/var/www/html(/.*)?'
    setype: httpd_sys_content_t
    state: present

- name: Apply SELinux contexts
  command: restorecon -Rv /var/www/html
```

### Firewall Management

**Targeted Firewall Rules**
```yaml
# Instead of disabling firewall
- name: Configure firewall for services
  firewalld:
    service: "{{ item }}"
    permanent: yes
    state: enabled
    immediate: yes
  loop:
    - dns
    - dhcp
    - http
    - https
    - tftp

- name: Configure firewall for custom ports
  firewalld:
    port: "{{ item }}"
    permanent: yes
    state: enabled
    immediate: yes
  loop:
    - 6443/tcp  # API server
    - 22623/tcp # Machine config
```

## Testing and Validation

### Pre-flight Checks

**Validate Prerequisites**
```yaml
- name: Check PowerVC connectivity
  uri:
    url: "{{ powervc.auth.auth_url }}"
    validate_certs: no
  register: powervc_check
  failed_when: powervc_check.status != 200

- name: Verify required images exist
  openstack.cloud.image_info:
    auth: "{{ powervc.auth }}"
    filters:
      name: "{{ item }}"
  register: image_check
  failed_when: image_check.images | length == 0
  loop:
    - "{{ bastion.image }}"
    - "{{ ocp_image }}"

- name: Check for required files
  stat:
    path: "{{ item }}"
  register: file_check
  failed_when: not file_check.stat.exists
  loop:
    - "{{ sshkey_file }}"
    - "{{ secret_file }}"
```

### Post-Deployment Validation

**Service Health Checks**
```yaml
- name: Verify DNS resolution
  command: dig +short api.{{ netname }}.{{ netdomain }} @{{ bastion.ip }}
  register: dns_check
  failed_when: bastion.ip not in dns_check.stdout

- name: Check DHCP service
  command: systemctl is-active dhcpd
  register: dhcp_status
  failed_when: dhcp_status.stdout != "active"

- name: Verify HAProxy backends
  uri:
    url: "http://{{ bastion.ip }}:9000/stats"
    return_content: yes
  register: haproxy_stats
  failed_when: "'UP' not in haproxy_stats.content"

- name: Test cluster API
  uri:
    url: "https://api.{{ netname }}.{{ netdomain }}:6443/healthz"
    validate_certs: no
  register: api_health
  failed_when: api_health.status != 200
```

## Common Patterns

### Service Orchestration

**Conditional Service Deployment**
```yaml
- name: Setup infrastructure services
  block:
    - include_tasks: setup_dns.yaml
      when: services.DNS | bool
    
    - include_tasks: setup_dhcp.yaml
      when: services.DHCP | bool
    
    - include_tasks: setup_haproxy.yaml
      when: services.HAPROXY | bool
  when: services.DNS or services.DHCP or services.HAPROXY
```

### Dynamic Inventory Generation

**MAC Address Mapping**
```yaml
- name: Initialize MAC mappings
  set_fact:
    MAC_nodes: []

- name: Collect MAC addresses
  include_tasks: get_mac.yaml
  loop: "{{ nodes }}"
  loop_control:
    loop_var: node

- name: Write MAC variables file
  copy:
    content: "{{ {'MAC_nodes': MAC_nodes} | to_nice_yaml }}"
    dest: ../vars/MAC_vars.yaml
```

### Cleanup and Rollback

**Resource Cleanup Pattern**
```yaml
- name: Delete all cluster LPARs
  openstack.cloud.server:
    auth: "{{ powervc.auth }}"
    name: "{{ item.name }}"
    state: absent
  loop: "{{ nodes }}"
  ignore_errors: yes

- name: Remove generated files
  file:
    path: "{{ item }}"
    state: absent
  loop:
    - ../install-config.yaml
    - ../agent-config.yaml
    - ../agent.ign
    - ../vars/MAC_vars.yaml
```

## Troubleshooting Guide

### Common Issues

**PowerVC Connection Failures**
```yaml
# Debug PowerVC authentication
- name: Test PowerVC auth
  openstack.cloud.auth:
    auth: "{{ powervc.auth }}"
  register: auth_result
  
- name: Display auth token
  debug:
    var: auth_result.ansible_facts.auth_token
```

**DHCP Not Assigning IPs**
```bash
# Check DHCP logs
journalctl -u dhcpd -f

# Verify MAC addresses in config
grep -A 2 "hardware ethernet" /etc/dhcp/dhcpd.conf

# Test DHCP lease
dhcping -s {{ bastion.ip }} -c {{ client_ip }}
```

**DNS Resolution Issues**
```bash
# Test DNS from bastion
dig @localhost api.ocp4.zhlab.lan

# Check zone files
named-checkzone zhlab.lan /var/named/zhlab.lan.db

# Verify named configuration
named-checkconf /etc/named.conf
```

**Network Boot Failures**
```bash
# Check TFTP service
systemctl status tftp

# Test TFTP file retrieval
tftp {{ bastion.ip }}
> get boot/grub2/powerpc-ieee1275/core.elf

# Verify HTTP access to ignition
curl http://{{ bastion.ip }}:8080/agent.ign
```

## Performance Optimization

### Parallel Execution

**Concurrent LPAR Creation**
```yaml
- name: Create all LPARs in parallel
  openstack.cloud.server:
    auth: "{{ powervc.auth }}"
    name: "{{ item.name }}"
    # ... configuration
  loop: "{{ nodes }}"
  async: 600
  poll: 0
  register: lpar_jobs

- name: Wait for all LPARs to be created
  async_status:
    jid: "{{ item.ansible_job_id }}"
  register: lpar_results
  until: lpar_results.finished
  retries: 60
  delay: 10
  loop: "{{ lpar_jobs.results }}"
```

### Fact Caching

**Enable Fact Caching**
```ini
# ansible.cfg
[defaults]
gathering = smart
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_facts
fact_caching_timeout = 86400
```

## Integration with CI/CD

### GitLab CI Example

```yaml
# .gitlab-ci.yml
stages:
  - validate
  - deploy
  - test

validate:
  stage: validate
  script:
    - ansible-lint playbooks/*.yaml
    - ansible-playbook --syntax-check playbooks/run-agent-based-install.yaml

deploy:
  stage: deploy
  script:
    - ansible-playbook playbooks/run-agent-based-install.yaml --vault-password-file $VAULT_PASS
  only:
    - main

test:
  stage: test
  script:
    - ansible-playbook playbooks/validate_cluster.yaml
```

## Key Takeaways

1. **Modularity is Critical**: Break complex deployments into single-purpose playbooks
2. **Idempotency Matters**: Always check before create, use declarative modules
3. **Security First**: Use Ansible Vault, proper SELinux, targeted firewall rules
4. **Template Everything**: Configuration files should be generated from templates
5. **Error Handling**: Implement wait loops, timeouts, and graceful failure handling
6. **Validation**: Pre-flight checks and post-deployment validation are essential
7. **Documentation**: Code should be self-documenting with clear variable names
8. **Testing**: Implement automated testing with Molecule or similar tools

## References

- [Ansible Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)
- [OpenShift on Power Documentation](https://docs.openshift.com/container-platform/latest/installing/installing_ibm_power/installing-ibm-power.html)
- [PowerVC API Documentation](https://www.ibm.com/docs/en/powervc)
- [HMC REST API Guide](https://www.ibm.com/support/pages/hmc-rest-api)
- [RHCOS Documentation](https://docs.openshift.com/container-platform/latest/architecture/architecture-rhcos.html)

---

**Skill Version:** 1.0  
**Last Updated:** 2026-05-06  
**Maintainer:** AnsibleEngineer  
**Source Repository:** ocp4-power
