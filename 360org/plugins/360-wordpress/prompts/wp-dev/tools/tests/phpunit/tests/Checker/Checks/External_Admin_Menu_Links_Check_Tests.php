<?php
/**
 * Tests for the External_Admin_Menu_Links_Check class.
 *
 * @package plugin-check
 */

use WordPress\Plugin_Check\Checker\Check_Categories;
use WordPress\Plugin_Check\Checker\Check_Context;
use WordPress\Plugin_Check\Checker\Check_Result;
use WordPress\Plugin_Check\Checker\Checks\Plugin_Repo\External_Admin_Menu_Links_Check;

class External_Admin_Menu_Links_Check_Tests extends WP_UnitTestCase {

	/**
	 * Test that external URLs in add_menu_page() (top-level menu) are detected as errors.
	 */
	public function test_detect_external_admin_menu_links_with_errors() {
		$check_context = new Check_Context( UNIT_TESTS_PLUGIN_DIR . 'test-plugin-external-admin-menu-links-with-errors/load.php' );
		$check_result  = new Check_Result( $check_context );

		$check = new External_Admin_Menu_Links_Check();
		$check->run( $check_result );

		$errors = $check_result->get_errors();

		$this->assertNotEmpty( $errors );
		$this->assertArrayHasKey( 'load.php', $errors );
		$this->assertGreaterThan( 0, $check_result->get_error_count() );

		// Check that the error code is correct.
		$found_external_menu_error = false;
		foreach ( $errors['load.php'] as $line => $columns ) {
			foreach ( $columns as $column => $messages ) {
				foreach ( $messages as $message ) {
					if ( 'external_admin_menu_link' === $message['code'] ) {
						$found_external_menu_error = true;
						break 3;
					}
				}
			}
		}
		$this->assertTrue( $found_external_menu_error, 'Expected external_admin_menu_link error code not found.' );
	}

	/**
	 * Test that internal slugs and external URLs in submenu functions do not trigger errors.
	 */
	public function test_no_errors_for_internal_admin_menu_links() {
		$check_context = new Check_Context( UNIT_TESTS_PLUGIN_DIR . 'test-plugin-external-admin-menu-links-without-errors/load.php' );
		$check_result  = new Check_Result( $check_context );

		$check = new External_Admin_Menu_Links_Check();
		$check->run( $check_result );

		$errors = $check_result->get_errors();

		$this->assertEmpty( $errors );
		$this->assertSame( 0, $check_result->get_error_count() );
	}

	/**
	 * Test that the check returns the correct categories.
	 */
	public function test_get_categories() {
		$check      = new External_Admin_Menu_Links_Check();
		$categories = $check->get_categories();

		$this->assertContains( Check_Categories::CATEGORY_PLUGIN_REPO, $categories );
	}

	/**
	 * Test that the check has a description.
	 */
	public function test_get_description() {
		$check       = new External_Admin_Menu_Links_Check();
		$description = $check->get_description();

		$this->assertNotEmpty( $description );
		$this->assertIsString( $description );
	}

	/**
	 * Test that the check has a documentation URL.
	 */
	public function test_get_documentation_url() {
		$check = new External_Admin_Menu_Links_Check();
		$url   = $check->get_documentation_url();

		$this->assertNotEmpty( $url );
		$this->assertStringContainsString( 'https://', $url );
	}
}
