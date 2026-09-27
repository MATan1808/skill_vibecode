<?php
/**
 * Tests for the Plugin_Content_Check class.
 *
 * @package plugin-check
 */

use WordPress\Plugin_Check\Checker\Check_Context;
use WordPress\Plugin_Check\Checker\Check_Result;
use WordPress\Plugin_Check\Checker\Checks\Plugin_Repo\Plugin_Content_Check;

class Plugin_Content_Check_Tests extends WP_UnitTestCase {

	public function test_detect_five_stars_reviews_without_errors() {
		$check_context = new Check_Context( UNIT_TESTS_PLUGIN_DIR . 'test-plugin-five-stars-without-errors/load.php' );
		$check_result  = new Check_Result( $check_context );

		$check = new Plugin_Content_Check();
		$check->run( $check_result );

		$errors = $check_result->get_errors();

		$this->assertNotEmpty( $errors );
		$this->assertSame( 2, $check_result->get_error_count() );

		$this->assertTrue( isset( $errors['load.php'][16][12][0] ) );
		$this->assertSame( 'five_star_reviews_detected', $errors['load.php'][16][12][0]['code'] );
		$this->assertTrue( isset( $errors['load.php'][17][16][0] ) );
		$this->assertSame( 'five_star_reviews_detected', $errors['load.php'][17][16][0]['code'] );
	}

	public function test_detect_block_api_version_errors_in_new_mode() {
		$check_context = new Check_Context( UNIT_TESTS_PLUGIN_DIR . 'test-plugin-block-api-version-with-errors/load.php', '', 'new' );
		$check_result  = new Check_Result( $check_context );

		$check = new Plugin_Content_Check();
		$check->run( $check_result );

		$errors = $check_result->get_errors();

		$this->assertArrayHasKey( 'blocks/missing/block.json', $errors );
		$this->assertArrayHasKey( 'blocks/empty/block.json', $errors );
		$this->assertArrayHasKey( 'blocks/v2/block.json', $errors );
		$this->assertArrayHasKey( 'includes/nested-block/block.json', $errors );
		$this->assertArrayNotHasKey( 'blocks/v3/block.json', $errors );
		$this->assertCount( 1, wp_list_filter( $errors['blocks/missing/block.json'][0][0], array( 'code' => 'block_api_version_too_low' ) ) );
		$this->assertSame( 7, $errors['blocks/missing/block.json'][0][0][0]['severity'] );
	}

	public function test_detect_block_api_version_errors_in_update_mode() {
		$check_context = new Check_Context( UNIT_TESTS_PLUGIN_DIR . 'test-plugin-block-api-version-with-errors/load.php', '', 'update' );
		$check_result  = new Check_Result( $check_context );

		$check = new Plugin_Content_Check();
		$check->run( $check_result );

		$this->assertArrayHasKey( 'blocks/missing/block.json', $check_result->get_errors() );
		$this->assertArrayHasKey( 'blocks/empty/block.json', $check_result->get_errors() );
		$this->assertArrayHasKey( 'blocks/v2/block.json', $check_result->get_errors() );
		$this->assertArrayHasKey( 'includes/nested-block/block.json', $check_result->get_errors() );
		$this->assertArrayNotHasKey( 'blocks/v3/block.json', $check_result->get_errors() );
		$this->assertCount( 0, wp_list_filter( $check_result->get_warnings()['blocks/missing/block.json'][0][0] ?? array(), array( 'code' => 'block_api_version_too_low' ) ) );
		$this->assertSame( 5, $check_result->get_errors()['blocks/missing/block.json'][0][0][0]['severity'] );
	}

	public function test_detect_block_api_version_without_errors() {
		$check_context = new Check_Context( UNIT_TESTS_PLUGIN_DIR . 'test-plugin-block-api-version-without-errors/load.php' );
		$check_result  = new Check_Result( $check_context );

		$check = new Plugin_Content_Check();
		$check->run( $check_result );

		$this->assertEmpty( wp_list_filter( $check_result->get_errors()['blocks/v3/block.json'][0][0] ?? array(), array( 'code' => 'block_api_version_too_low' ) ) );
		$this->assertEmpty( wp_list_filter( $check_result->get_errors()['blocks/v4/block.json'][0][0] ?? array(), array( 'code' => 'block_api_version_too_low' ) ) );
		$this->assertEmpty( wp_list_filter( $check_result->get_warnings()['blocks/v3/block.json'][0][0] ?? array(), array( 'code' => 'block_api_version_too_low' ) ) );
		$this->assertEmpty( wp_list_filter( $check_result->get_warnings()['blocks/v4/block.json'][0][0] ?? array(), array( 'code' => 'block_api_version_too_low' ) ) );
	}
}
