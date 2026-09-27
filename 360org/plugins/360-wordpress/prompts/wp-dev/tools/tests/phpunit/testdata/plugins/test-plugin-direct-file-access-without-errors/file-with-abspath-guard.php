<?php
/**
 * File with ABSPATH guard.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function my_plugin_function() {
	return 'test';
}
