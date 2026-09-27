<?php
/**
 * Tests for the Universal_Runtime_Preparation class.
 *
 * @package plugin-check
 */

namespace Checker\Preparations;

use WordPress\Plugin_Check\Checker\Check_Context;
use WordPress\Plugin_Check\Checker\Preparations\Universal_Runtime_Preparation;
use WordPress\Plugin_Check\Checker\Runtime_Environment_Setup;
use WP_UnitTestCase;

class Universal_Runtime_Preparation_Tests extends WP_UnitTestCase {

	/**
	 * Storage for preparation cleanups that need to be run after a test.
	 *
	 * @var array
	 */
	private $cleanups = array();

	public function tear_down() {
		if ( count( $this->cleanups ) > 0 ) {
			$this->cleanups = array_reverse( $this->cleanups );
			foreach ( $this->cleanups as $cleanup ) {
				$cleanup();
			}
			$this->cleanups = array();
		}
		parent::tear_down();
	}

	public function test_prepare() {
		$check_context = new Check_Context( plugin_basename( WP_PLUGIN_CHECK_MAIN_FILE ) );

		// The runtime environment must be prepared manually before regular runtime preparations.
		$runtime = new Runtime_Environment_Setup();
		$runtime->set_up();
		$this->cleanups[] = function () use ( $runtime ) {
			$runtime->clean_up();
		};

		$universal_runtime_preparation = new Universal_Runtime_Preparation( $check_context );

		$cleanup          = $universal_runtime_preparation->prepare();
		$this->cleanups[] = $cleanup;

		$this->assertTrue( has_filter( 'option_active_plugins' ) );
		$this->assertTrue( has_filter( 'default_option_active_plugins' ) );
		$this->assertTrue( has_filter( 'stylesheet' ) );
		$this->assertTrue( has_filter( 'template' ) );
		$this->assertTrue( has_filter( 'pre_option_template' ) );
		$this->assertTrue( has_filter( 'pre_option_stylesheet' ) );
		$this->assertTrue( has_filter( 'pre_option_current_theme' ) );
		$this->assertTrue( has_filter( 'pre_option_template_root' ) );
		$this->assertTrue( has_filter( 'pre_option_stylesheet_root' ) );

		$cleanup();

		// If this is reached, the universal runtime preparation cleanup was already done, so we can remove it again.
		array_pop( $this->cleanups );

		$this->assertFalse( has_filter( 'option_active_plugins' ) );
		$this->assertFalse( has_filter( 'default_option_active_plugins' ) );
		$this->assertFalse( has_filter( 'stylesheet' ) );
		$this->assertFalse( has_filter( 'template' ) );
		$this->assertFalse( has_filter( 'pre_option_template' ) );
		$this->assertFalse( has_filter( 'pre_option_stylesheet' ) );
		$this->assertFalse( has_filter( 'pre_option_current_theme' ) );
		$this->assertFalse( has_filter( 'pre_option_template_root' ) );
		$this->assertFalse( has_filter( 'pre_option_stylesheet_root' ) );
	}
}
