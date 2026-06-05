<?php
require_once 'plugins/login-servers.php';

return new \AdminerLoginServers([
    'Floci RDS (PostgreSQL)' => [
        'server' => 'floci:7001',
        'driver' => 'pgsql',
    ],
]);
