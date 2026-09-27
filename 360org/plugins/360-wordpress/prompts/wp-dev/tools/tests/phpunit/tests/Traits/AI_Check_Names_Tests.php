<?php
/**
 * Tests for the AI_Check_Names trait.
 *
 * @package plugin-check
 */

use WordPress\Plugin_Check\Traits\AI_Check_Names;

/**
 * Test class for AI_Check_Names trait.
 */
class AI_Check_Names_Tests extends WP_UnitTestCase {

	use AI_Check_Names;

	/**
	 * Test basic key-value parsing with string values (without dashes).
	 */
	public function test_parse_markdown_format_basic_string() {
		$text = "key1: value1\nkey2: value2";

		$result = $this->parse_markdown_format( $text );

		$this->assertIsArray( $result );
		$this->assertSame( 'value1', $result['key1'] );
		$this->assertSame( 'value2', $result['key2'] );
	}

	/**
	 * Test parsing with extra whitespace (without dashes).
	 */
	public function test_parse_markdown_format_with_whitespace() {
		$text = "  key1   :   value1   \n key2:value2  ";

		$result = $this->parse_markdown_format( $text );

		$this->assertSame( 'value1', $result['key1'] );
		$this->assertSame( 'value2', $result['key2'] );
	}

	/**
	 * Test skipping empty lines.
	 */
	public function test_parse_markdown_format_skips_empty_lines() {
		$text = "key1: value1\n\n\nkey2: value2";

		$result = $this->parse_markdown_format( $text );

		$this->assertCount( 2, $result );
		$this->assertSame( 'value1', $result['key1'] );
		$this->assertSame( 'value2', $result['key2'] );
	}

	/**
	 * Test backward compatibility with dash format.
	 */
	public function test_parse_markdown_format_with_dashes_backward_compatibility() {
		$text = "- key1: value1\n- key2: value2";

		$result = $this->parse_markdown_format( $text );

		$this->assertCount( 2, $result );
		$this->assertSame( 'value1', $result['key1'] );
		$this->assertSame( 'value2', $result['key2'] );
	}

	/**
	 * Test mixed format (with and without dashes).
	 */
	public function test_parse_markdown_format_mixed_dash_format() {
		$text = "- key1: value1\nkey2: value2\n- key3: value3";

		$result = $this->parse_markdown_format( $text );

		$this->assertCount( 3, $result );
		$this->assertSame( 'value1', $result['key1'] );
		$this->assertSame( 'value2', $result['key2'] );
		$this->assertSame( 'value3', $result['key3'] );
	}

	/**
	 * Test skipping lines without colon.
	 */
	public function test_parse_markdown_format_skips_lines_without_colon() {
		$text = "key1: value1\ninvalid line without colon\nkey2: value2";

		$result = $this->parse_markdown_format( $text );

		$this->assertCount( 2, $result );
		$this->assertArrayNotHasKey( 'invalid line without colon', $result );
	}

	/**
	 * Test skipping lines with empty keys.
	 */
	public function test_parse_markdown_format_skips_empty_keys() {
		$text = ": value with no key\nkey1: value1";

		$result = $this->parse_markdown_format( $text );

		$this->assertCount( 1, $result );
		$this->assertSame( 'value1', $result['key1'] );
	}

	/**
	 * Test parsing boolean true values.
	 */
	public function test_parse_markdown_format_boolean_true() {
		$text = "bool1: true\nbool2: TRUE\nbool3: True";

		$result = $this->parse_markdown_format( $text );

		$this->assertTrue( $result['bool1'] );
		$this->assertTrue( $result['bool2'] );
		$this->assertTrue( $result['bool3'] );
	}

	/**
	 * Test parsing boolean false values.
	 */
	public function test_parse_markdown_format_boolean_false() {
		$text = "bool1: false\nbool2: FALSE\nbool3: False";

		$result = $this->parse_markdown_format( $text );

		$this->assertFalse( $result['bool1'] );
		$this->assertFalse( $result['bool2'] );
		$this->assertFalse( $result['bool3'] );
	}

	/**
	 * Test parsing JSON arrays.
	 */
	public function test_parse_markdown_format_json_arrays() {
		$text = 'array1: ["item1", "item2", "item3"]' . "\n" .
				'array2: [1, 2, 3]';

		$result = $this->parse_markdown_format( $text );

		$this->assertIsArray( $result['array1'] );
		$this->assertSame( array( 'item1', 'item2', 'item3' ), $result['array1'] );
		$this->assertIsArray( $result['array2'] );
		$this->assertSame( array( 1, 2, 3 ), $result['array2'] );
	}

	/**
	 * Test parsing invalid JSON arrays falls back to string.
	 */
	public function test_parse_markdown_format_invalid_json_as_string() {
		$text = 'invalid_json: [incomplete';

		$result = $this->parse_markdown_format( $text );

		$this->assertIsString( $result['invalid_json'] );
		$this->assertSame( '[incomplete', $result['invalid_json'] );
	}

	/**
	 * Test parsing comma-separated values for disallowed_type key.
	 */
	public function test_parse_markdown_format_disallowed_type_csv() {
		$text = 'disallowed_type: trademark, generic, misleading';

		$result = $this->parse_markdown_format( $text );

		$this->assertIsArray( $result['disallowed_type'] );
		$this->assertSame( array( 'trademark', 'generic', 'misleading' ), $result['disallowed_type'] );
	}

	/**
	 * Test that comma-separated values only work for disallowed_type key.
	 */
	public function test_parse_markdown_format_csv_only_for_disallowed_type() {
		$text = "other_key: value1, value2, value3\ndisallowed_type: type1, type2";

		$result = $this->parse_markdown_format( $text );

		// other_key should remain as string.
		$this->assertIsString( $result['other_key'] );
		$this->assertSame( 'value1, value2, value3', $result['other_key'] );

		// disallowed_type should be parsed as array.
		$this->assertIsArray( $result['disallowed_type'] );
		$this->assertSame( array( 'type1', 'type2' ), $result['disallowed_type'] );
	}

	/**
	 * Test parsing values with colons in them.
	 */
	public function test_parse_markdown_format_value_with_colons() {
		$text = 'url: https://example.com:8080/path';

		$result = $this->parse_markdown_format( $text );

		$this->assertSame( 'https://example.com:8080/path', $result['url'] );
	}

	/**
	 * Test empty input returns empty array.
	 */
	public function test_parse_markdown_format_empty_input() {
		$text = '';

		$result = $this->parse_markdown_format( $text );

		$this->assertIsArray( $result );
		$this->assertEmpty( $result );
	}

	/**
	 * Test whitespace-only input returns empty array.
	 */
	public function test_parse_markdown_format_whitespace_only() {
		$text = "   \n\n   \n  ";

		$result = $this->parse_markdown_format( $text );

		$this->assertIsArray( $result );
		$this->assertEmpty( $result );
	}

	/**
	 * Test mixed data types in one text (new format without dashes).
	 */
	public function test_parse_markdown_format_mixed_types() {
		$text = 'string_value: hello world' . "\n" .
				'bool_true: true' . "\n" .
				'bool_false: false' . "\n" .
				'json_array: ["a", "b", "c"]' . "\n" .
				'disallowed_type: type1, type2' . "\n" .
				'number_as_string: 42';

		$result = $this->parse_markdown_format( $text );

		$this->assertIsString( $result['string_value'] );
		$this->assertSame( 'hello world', $result['string_value'] );

		$this->assertTrue( $result['bool_true'] );
		$this->assertFalse( $result['bool_false'] );

		$this->assertIsArray( $result['json_array'] );
		$this->assertSame( array( 'a', 'b', 'c' ), $result['json_array'] );

		$this->assertIsArray( $result['disallowed_type'] );
		$this->assertSame( array( 'type1', 'type2' ), $result['disallowed_type'] );

		$this->assertIsString( $result['number_as_string'] );
		$this->assertSame( '42', $result['number_as_string'] );
	}

	/**
	 * Test keys with underscores and numbers.
	 */
	public function test_parse_markdown_format_complex_keys() {
		$text = "key_with_underscore: value1\nkey123: value2\nKey_Name_123: value3";

		$result = $this->parse_markdown_format( $text );

		$this->assertSame( 'value1', $result['key_with_underscore'] );
		$this->assertSame( 'value2', $result['key123'] );
		$this->assertSame( 'value3', $result['Key_Name_123'] );
	}

	/**
	 * Test trimming of extra spaces in comma-separated values.
	 */
	public function test_parse_markdown_format_disallowed_type_with_spaces() {
		$text = 'disallowed_type:  type1  ,  type2  ,  type3  ';

		$result = $this->parse_markdown_format( $text );

		$this->assertIsArray( $result['disallowed_type'] );
		$this->assertSame( array( 'type1', 'type2', 'type3' ), $result['disallowed_type'] );
	}

	/**
	 * Test real-world AI response format (new format without dashes).
	 */
	public function test_parse_markdown_format_realistic_ai_response() {
		$text = 'possible_naming_issues: true' . "\n" .
				'possible_owner_issues: false' . "\n" .
				'possible_description_issues: false' . "\n" .
				'naming_explanation: The plugin name may be too generic' . "\n" .
				'owner_explanation: No trademark issues detected' . "\n" .
				'description_explanation: Description is clear and appropriate' . "\n" .
				'trademarks_or_project_names_array: ["WordPress", "WooCommerce"]' . "\n" .
				'suggested_display_name: My Custom Integration for WooCommerce' . "\n" .
				'suggested_slug: my-custom-integration-woocommerce' . "\n" .
				'short_description: Integrates custom features with WooCommerce' . "\n" .
				'description_language_is_in_english: true' . "\n" .
				'description_what_is_not_in_english: None' . "\n" .
				'plugin_category: E-commerce';

		$result = $this->parse_markdown_format( $text );

		$this->assertTrue( $result['possible_naming_issues'] );
		$this->assertFalse( $result['possible_owner_issues'] );
		$this->assertFalse( $result['possible_description_issues'] );
		$this->assertIsString( $result['naming_explanation'] );
		$this->assertIsArray( $result['trademarks_or_project_names_array'] );
		$this->assertSame( array( 'WordPress', 'WooCommerce' ), $result['trademarks_or_project_names_array'] );
		$this->assertSame( 'My Custom Integration for WooCommerce', $result['suggested_display_name'] );
		$this->assertSame( 'my-custom-integration-woocommerce', $result['suggested_slug'] );
		$this->assertTrue( $result['description_language_is_in_english'] );
	}

	/**
	 * Test that duplicate keys use the last occurrence.
	 */
	public function test_parse_markdown_format_duplicate_keys() {
		$text = "key1: first_value\nkey1: second_value\nkey1: final_value";

		$result = $this->parse_markdown_format( $text );

		// Should have only one entry for key1 with the last value.
		$this->assertCount( 1, $result );
		$this->assertSame( 'final_value', $result['key1'] );
	}

	/**
	 * Test empty value after colon.
	 */
	public function test_parse_markdown_format_empty_value() {
		$text = "key1:\nkey2: value2";

		$result = $this->parse_markdown_format( $text );

		$this->assertSame( '', $result['key1'] );
		$this->assertSame( 'value2', $result['key2'] );
	}

	/**
	 * Test special characters in values.
	 */
	public function test_parse_markdown_format_special_characters() {
		$text = 'special: value with @#$%^&*() characters' . "\n" .
				'emoji: 🚀 rocket ship' . "\n" .
				'quotes: "quoted value"';

		$result = $this->parse_markdown_format( $text );

		$this->assertSame( 'value with @#$%^&*() characters', $result['special'] );
		$this->assertSame( '🚀 rocket ship', $result['emoji'] );
		$this->assertSame( '"quoted value"', $result['quotes'] );
	}

	/**
	 * Test multiline descriptions (only first line should be captured).
	 */
	public function test_parse_markdown_format_multiline_handling() {
		$text = "key1: value1\nkey2: value on first line\nThis is not a new key\nkey3: value3";

		$result = $this->parse_markdown_format( $text );

		// Should only capture lines with key: value format.
		$this->assertCount( 3, $result );
		$this->assertSame( 'value1', $result['key1'] );
		$this->assertSame( 'value on first line', $result['key2'] );
		$this->assertSame( 'value3', $result['key3'] );
	}

	/**
	 * Test long explanations (realistic scenario).
	 */
	public function test_parse_markdown_format_long_explanation() {
		$text = 'naming_explanation: This plugin name contains the trademark "WordPress" which should be avoided. Consider renaming to something more distinctive.';

		$result = $this->parse_markdown_format( $text );

		$this->assertIsString( $result['naming_explanation'] );
		$this->assertStringContainsString( 'trademark', $result['naming_explanation'] );
	}

	/**
	 * Test empty JSON array.
	 */
	public function test_parse_markdown_format_empty_json_array() {
		$text = 'empty_array: []';

		$result = $this->parse_markdown_format( $text );

		$this->assertIsArray( $result['empty_array'] );
		$this->assertEmpty( $result['empty_array'] );
	}

	/**
	 * Test JSON array with nested objects (should parse as array).
	 */
	public function test_parse_markdown_format_nested_json() {
		$text = 'nested: [{"name": "test1"}, {"name": "test2"}]';

		$result = $this->parse_markdown_format( $text );

		$this->assertIsArray( $result['nested'] );
		$this->assertCount( 2, $result['nested'] );
		$this->assertIsArray( $result['nested'][0] );
		$this->assertSame( 'test1', $result['nested'][0]['name'] );
	}
}
