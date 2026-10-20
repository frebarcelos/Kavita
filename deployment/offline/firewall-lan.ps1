#requires -RunAsAdministrator
param(
    # The private address Kavita is published on, on the home Wi-Fi
    [string]$Address = '192.168.1.113',
    [string]$InterfaceAlias = 'Wi-Fi',
    [string]$Subnet = '192.168.1.0/24',
    # 5000: Kavita over HTTP; 5443: the HTTPS proxy (compose.https.yaml). Leave out 5000 once every client uses HTTPS.
    [int[]]$Ports = @(5000, 5443)
)
$ErrorActionPreference = 'Stop'
# Fork: the Windows firewall rules for Kavita on the home network (versioned from _temp/offline-f1/enable-lan-firewall.ps1).
# Allows the home subnet and blocks everything else on the given ports. Does not change the Docker publication.

if (-not (Get-NetIPAddress -AddressFamily IPv4 -IPAddress $Address -InterfaceAlias $InterfaceAlias -ErrorAction SilentlyContinue)) {
    throw "The $InterfaceAlias address is not $Address. Do not apply old rules: check the DHCP reservation first."
}

$ruleBase = @{
    Direction = 'Inbound'
    Protocol = 'TCP'
    LocalAddress = $Address
    LocalPort = $Ports
    InterfaceAlias = $InterfaceAlias
    Profile = 'Any'
    EdgeTraversalPolicy = 'Block'
}
$rules = @(
    @{
        Name = 'KavitaOfflineF1-BlockOutsideLAN'
        DisplayName = 'Kavita Offline F1 - bloquear fora da sub-rede local'
        Action = 'Block'
        RemoteAddress = @('0.0.0.0-192.168.0.255', '192.168.2.0-255.255.255.255')
    },
    @{
        Name = 'KavitaOfflineF1-AllowLAN'
        DisplayName = 'Kavita Offline F1 - permitir Wi-Fi local'
        Action = 'Allow'
        RemoteAddress = $Subnet
    }
)
foreach ($rule in $rules) {
    if (Get-NetFirewallRule -Name $rule.Name -ErrorAction SilentlyContinue) {
        # Set identifies the rule by -Name; -DisplayName would be read as a second identifier
        $update = $rule.Clone()
        $update.Remove('DisplayName')
        Set-NetFirewallRule @ruleBase @update -Enabled True
    } else {
        New-NetFirewallRule @ruleBase @rule -Enabled True | Out-Null
    }
}
Write-Host "Kavita firewall rules: ports $($Ports -join ', ') on $Address, only from $Subnet."
