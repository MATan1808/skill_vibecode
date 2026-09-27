<?php
/**
 * File with guard and header() calls before exit.
 */

if (!defined('ABSPATH')) {
	header('Status: 403 Forbidden');
	header('HTTP/1.1 403 Forbidden');
	exit();
}

function my_function() {
	// Some code.
}
