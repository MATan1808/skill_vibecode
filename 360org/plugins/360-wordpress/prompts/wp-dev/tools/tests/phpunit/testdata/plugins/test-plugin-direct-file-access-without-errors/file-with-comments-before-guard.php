<?php
/**
 * Plugin Name: Test Plugin
 * Plugin URI: https://example.com
 * Description: Some description
 * Version: 1.0.0
 * Author: Test Author
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: test-plugin
 *
 * @package test-plugin
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function my_plugin_function() {
	return 'test';
}
