<?php
require_once 'plugins/login-servers.php';

return new \AdminerLoginServers([
    'Floci RDS (MySQL)' => [
        'server' => 'floci:7001',
        'driver' => 'server',
    ],
]);
