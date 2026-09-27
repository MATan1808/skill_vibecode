<?php
/**
 * Plugin Name: Test Plugin External Admin Menu Links With Errors
 * Plugin URI: https://github.com/WordPress/plugin-check
 * Description: Test plugin with external URLs in admin menu functions.
 * Requires at least: 6.0
 * Requires PHP: 5.6
 * Version: 1.0.0
 * Author: WordPress Performance Team
 * Author URI: https://make.wordpress.org/performance/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 * Text Domain: test-plugin-external-admin-menu-links-with-errors
 *
 * @package test-plugin-external-admin-menu-links-with-errors
 */

/**
 * These are examples of problematic code that adds external links to
 * the TOP-LEVEL admin menu using add_menu_page().
 */

// ❌ Adding external link to top-level menu with https.
add_menu_page(
	'External Resource',
	'External Resource',
	'manage_options',
	'https://example.com/external-page',
	'',
	'dashicons-admin-site',
	30
);

// ❌ Adding external link to top-level menu with http.
add_menu_page(
	'HTTP External',
	'HTTP External',
	'manage_options',
	'http://example.com/http-page',
	'',
	'dashicons-admin-site',
	31
);

// ❌ Adding external link with protocol-relative URL to top-level menu.
add_menu_page(
	'Protocol Relative',
	'Protocol Relative',
	'manage_options',
	'//example.com/protocol-relative',
	'',
	'dashicons-admin-site',
	32
);
