<?php
/**
 * Plugin Name: Test Plugin External Admin Menu Links Without Errors
 * Plugin URI: https://github.com/WordPress/plugin-check
 * Description: Test plugin with proper internal admin menu usage.
 * Requires at least: 6.0
 * Requires PHP: 5.6
 * Version: 1.0.0
 * Author: WordPress Performance Team
 * Author URI: https://make.wordpress.org/performance/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 * Text Domain: test-plugin-external-admin-menu-links-without-errors
 *
 * @package test-plugin-external-admin-menu-links-without-errors
 */

/**
 * These are examples of correct admin menu usage with internal slugs.
 */

// ✅ Adding internal page to main menu.
add_menu_page(
	'My Plugin Settings',
	'My Plugin',
	'manage_options',
	'my-plugin-settings',
	'my_plugin_settings_page',
	'dashicons-admin-generic',
	30
);

// ✅ Adding internal page to options menu.
add_options_page(
	'My Plugin Options',
	'My Plugin',
	'manage_options',
	'my-plugin-options',
	'my_plugin_options_page'
);

// ✅ Adding internal page to management/tools menu.
add_management_page(
	'My Plugin Tools',
	'My Plugin Tools',
	'manage_options',
	'my-plugin-tools',
	'my_plugin_tools_page'
);

// ✅ Adding internal page to theme menu.
add_theme_page(
	'Theme Settings',
	'Theme Settings',
	'manage_options',
	'my-theme-settings',
	'my_theme_settings_page'
);

// ✅ Adding internal page to plugins menu.
add_plugins_page(
	'Plugin Manager',
	'Plugin Manager',
	'manage_options',
	'my-plugin-manager',
	'my_plugin_manager_page'
);

// ✅ Adding internal page to users menu.
add_users_page(
	'User Settings',
	'User Settings',
	'manage_options',
	'my-user-settings',
	'my_user_settings_page'
);

// ✅ Adding internal page to dashboard menu.
add_dashboard_page(
	'Dashboard Info',
	'Dashboard Info',
	'manage_options',
	'my-dashboard-info',
	'my_dashboard_info_page'
);

// ✅ Adding submenu page with external URL is allowed.
add_submenu_page(
	'my-plugin-settings',
	'Documentation',
	'Documentation',
	'manage_options',
	'https://example.com/docs',
	''
);

// ✅ External URLs in submenu functions are allowed for docs, support, etc.
add_options_page(
	'Plugin Documentation',
	'Documentation',
	'manage_options',
	'https://example.com/plugin-docs'
);

// ✅ External URL in management page for support link.
add_management_page(
	'Support',
	'Get Support',
	'manage_options',
	'https://example.com/support'
);

// ✅ Adding submenu page with internal slug.
add_submenu_page(
	'my-plugin-settings',
	'Advanced Settings',
	'Advanced',
	'manage_options',
	'my-plugin-advanced',
	'my_plugin_advanced_page'
);

/**
 * Callback functions for admin pages.
 */
function my_plugin_settings_page() {
	echo '<div class="wrap"><h1>My Plugin Settings</h1></div>';
}

function my_plugin_options_page() {
	echo '<div class="wrap"><h1>My Plugin Options</h1></div>';
}

function my_plugin_tools_page() {
	echo '<div class="wrap"><h1>My Plugin Tools</h1></div>';
}

function my_theme_settings_page() {
	echo '<div class="wrap"><h1>Theme Settings</h1></div>';
}

function my_plugin_manager_page() {
	echo '<div class="wrap"><h1>Plugin Manager</h1></div>';
}

function my_user_settings_page() {
	echo '<div class="wrap"><h1>User Settings</h1></div>';
}

function my_dashboard_info_page() {
	echo '<div class="wrap"><h1>Dashboard Info</h1></div>';
}

function my_plugin_advanced_page() {
	echo '<div class="wrap"><h1>Advanced Settings</h1></div>';
}
