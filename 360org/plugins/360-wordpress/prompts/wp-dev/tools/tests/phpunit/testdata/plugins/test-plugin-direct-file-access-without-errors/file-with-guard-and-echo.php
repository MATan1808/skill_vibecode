<?php
/**
 * File with guard and echo statements before exit.
 */

if ( ! defined( 'ABSPATH' ) ) {
	echo 'Hi there!  I\'m just a plugin, not much I can do when called directly.';
	exit;
}

define( 'PLUGIN_VERSION', '1.0.0' );
