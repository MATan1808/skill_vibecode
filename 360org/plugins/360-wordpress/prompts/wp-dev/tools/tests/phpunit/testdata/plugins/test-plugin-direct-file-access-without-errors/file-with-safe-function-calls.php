<?php
/**
 * File with only safe function calls (class_exists, function_exists) - should be allowed.
 */

if ( ! class_exists( 'Some_Class' ) ) {
	return;
}

if ( class_exists( 'Another_Class' ) && function_exists( 'some_function' ) ) {
	return;
}
