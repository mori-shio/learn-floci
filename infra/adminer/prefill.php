<?php

class AdminerPrefill extends \Adminer\Plugin {
    private $defaults;

    public function __construct(array $defaults) {
        $this->defaults = $defaults;
    }

    public function loginFormField($name, $heading, $field) {
        if (!isset($this->defaults[$name])) {
            return null;
        }
        $value = htmlspecialchars($this->defaults[$name], ENT_QUOTES);

        if ($name === 'password') {
            $field = preg_replace(
                '/<input type="password" name="auth\[password\]"/',
                '<input type="password" name="auth[password]" value="' . $value . '"',
                $field
            );
        } else {
            $field = preg_replace(
                '/(name="auth\[' . preg_quote($name, '/') . '\]"\s+(?:id="[^"]+"\s+)?(?:autofocus\s+)?value=")[^"]*(")/',
                '${1}' . $value . '${2}',
                $field
            );
        }

        return $heading . $field . "\n";
    }
}

return new AdminerPrefill([
    'server'   => 'floci:7001',
    'username' => 'admin',
    'password' => 'password',
    'db'       => 'floci_test_dev',
]);
