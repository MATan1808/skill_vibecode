<?php
/**
 * File with class but no guard - should be allowed since it only has a class.
 */

namespace TestPlugin;

/**
 * Test class.
 */
class Test_Class {
	/**
	 * Property.
	 *
	 * @var string
	 */
	private $property = 'test';

	/**
	 * Method.
	 *
	 * @return string
	 */
	public function get_property() {
		return $this->property;
	}
}
