<?php
/**
 * Plugin Name: Test Plugin Updaters PUC Use Errors for Plugin Check
 * Plugin URI: https://github.com/WordPress/plugin-check
 * Description: Some plugin description.
 * Requires at least: 6.0
 * Requires PHP: 5.6
 * Version: 1.0.0
 * Author: WordPress Performance Team
 * Author URI: https://make.wordpress.org/performance/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 * Text Domain: test-plugin-updaters-puc-use-errors
 *
 * @package test-plugin-updaters-puc-use-errors
 */

// Use statement + short name - matches both PUC regexes.
use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

$update_checker = PucFactory::buildUpdateChecker(
	'https://example.com/plugin-info.json',
	__FILE__,
	'my-plugin-slug'
);
