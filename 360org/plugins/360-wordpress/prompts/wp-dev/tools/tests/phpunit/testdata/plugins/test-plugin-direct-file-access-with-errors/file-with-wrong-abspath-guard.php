<?php
/**
 * File with wrong guard - ABSPATH without quotes.
 * This is invalid and should be flagged.
 */

if (!defined(ABSPATH)) {
	exit;
}

function my_function() {
	// Some code.
}
