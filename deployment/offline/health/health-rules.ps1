# What the health task does for a state of the server. Pure: check-health.ps1 gathers the state and acts.
# State: DockerUp, Container (running, exited, created, missing, ...), Health (healthy, unhealthy, starting or empty),
# LanAddressPresent (the PC has the address the container publishes on), ApiReachable (/api/health answers on it),
# LogsMB, LogsLimitMB, RestartedRecently (this task restarted it in the last hour), DockerStartedRecently (this task
# opened Docker Desktop in the last 15 minutes).
# Actions: start-docker, start, restart, or alert with a message. Nothing creates a container or changes where it is published.
function Get-HealthActions {
    param([hashtable]$State)
    $actions = @()
    function Alert([string]$message) { [pscustomobject]@{ Kind = 'alert'; Message = $message } }
    function Act([string]$kind, [string]$message) { [pscustomobject]@{ Kind = $kind; Message = $message } }

    if (-not $State.DockerUp) {
        if (-not $State.DockerStartedRecently) {
            return @(Act 'start-docker' 'Docker Desktop parado: aberto pela tarefa.')
        }
        return @(Alert 'Docker Desktop não está rodando: o Kavita está fora do ar.')
    }
    if ($State.Container -eq 'missing') {
        return @(Alert 'O container do Kavita não existe. Use deploy-fork.ps1; esta tarefa não cria containers.')
    }
    if ($State.Container -ne 'running') {
        if (-not $State.LanAddressPresent) {
            $actions += Alert 'O IP da rede doméstica em que o Kavita publica não está neste PC (Wi-Fi desligado ou IP trocado pelo DHCP). O container fica parado.'
        } else {
            $actions += Act 'start' "Container parado ($($State.Container)): iniciado."
        }
    } elseif ($State.Health -eq 'unhealthy') {
        if ($State.RestartedRecently) {
            $actions += Alert 'O Kavita continua sem saúde depois de reiniciado. Veja docker logs.'
        } else {
            $actions += Act 'restart' 'Container sem saúde: reiniciado.'
        }
    } elseif ($State.Health -eq 'healthy' -and -not $State.ApiReachable) {
        $actions += Alert 'O Kavita está saudável, mas não responde no IP da rede doméstica (firewall ou IP).'
    }
    if ($State.LogsMB -gt $State.LogsLimitMB) {
        $actions += Alert "Os logs do Kavita passaram de $($State.LogsLimitMB) MB ($([math]::Round($State.LogsMB)) MB)."
    }
    return $actions
}
